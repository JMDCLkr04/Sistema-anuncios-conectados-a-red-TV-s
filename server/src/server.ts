import type net from 'node:net';
import http from 'node:http';

import { createApp } from './app.js';
import { ensureBootstrapAdmin } from './bootstrap.js';
import { closePool } from './config/db.js';
import { config } from './config/env.js';
import { logger } from './config/logger.js';
import * as announcementService from './services/announcement.service.js';
import { describeNetworkScope } from './utils/network.js';
import { attachWebSocketServer, closeWebSocketServer } from './websocket/hub.js';

/**
 * Punto de entrada del monolito: un único proceso HTTP sirve la API REST,
 * el WebSocket (RFC 6455) y la aplicación React compilada.
 */
const EXPIRE_CHECK_INTERVAL_MS = 60_000;

async function main(): Promise<void> {
  const app = createApp();
  const server = http.createServer(app);

  // Endurecimiento del servidor HTTP (ISO 27001 A.8.6 capacidad, A.8.20 redes):
  // tiempos acotados para mitigar conexiones lentas (slowloris).
  server.headersTimeout = 20_000;
  server.requestTimeout = 60_000;
  server.keepAliveTimeout = 65_000;
  server.maxRequestsPerSocket = 0;

  // Los sockets que se convierten en WebSocket son de larga duración: se
  // desactiva su tiempo de inactividad y el latido del hub se encarga (RFC 6455).
  server.on('upgrade', (_request, socket) => {
    (socket as net.Socket).setTimeout(0);
  });

  attachWebSocketServer(server);

  try {
    await ensureBootstrapAdmin();
  } catch (error) {
    logger.error('No fue posible preparar la cuenta administradora', {
      error: (error as Error).message,
    });
    if (config.isProduction) throw error;
  }

  // Tarea programada: expira anuncios cuya ventana terminó y avisa al instante.
  const expireTimer = setInterval(() => {
    void announcementService
      .expireDue()
      .then((total) => {
        if (total > 0) logger.info('Anuncios expirados automáticamente', { total });
      })
      .catch((error: unknown) => {
        logger.error('Fallo la tarea de expiración de anuncios', {
          error: (error as Error).message,
        });
      });
  }, EXPIRE_CHECK_INTERVAL_MS);
  expireTimer.unref();

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, config.host, () => {
      server.off('error', reject);
      resolve();
    });
  });

  logger.info('Monolito de anuncios en ejecución (MVP)', {
    api: `http://${config.host}:${config.port}/api`,
    websocket: `ws://${config.host}:${config.port}/ws`,
    entorno: config.nodeEnv,
    scopeRed: describeNetworkScope(config.host),
    corsPermitidos: config.corsOrigins,
    jwtSecretEfimero: config.jwtSecretIsEphemeral,
  });
  if (config.jwtSecretIsEphemeral) {
    logger.warn('JWT_SECRET no configurada: se generó una clave efímera solo para desarrollo.');
  }

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('Deteniendo el servicio…', { signal });

    clearInterval(expireTimer);
    closeWebSocketServer();

    const forceExit = setTimeout(() => {
      logger.error('Cierre forzado: el servidor no respondió a tiempo');
      process.exit(1);
    }, 10_000);
    forceExit.unref();

    await new Promise<void>((resolve) => server.close(() => resolve()));
    await closePool();
    logger.info('Servicio detenido correctamente');
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => {
    logger.error('Promesa rechazada sin manejar', { reason: String(reason) });
  });
  process.on('uncaughtException', (error) => {
    logger.error('Excepción no capturada', { error: error.message, stack: error.stack });
    void shutdown('uncaughtException');
  });
}

main().catch((error: unknown) => {
  logger.error('No fue posible iniciar el servicio', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
