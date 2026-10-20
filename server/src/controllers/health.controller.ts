import type { Request, Response } from 'express';

import { config } from '../config/env.js';
import { pingDatabase } from '../config/db.js';
import type { HealthStatus } from '../domain/types.js';
import * as hub from '../websocket/hub.js';

/**
 * CONTROLADOR de diagnóstico. Expone sólo información no sensible
 * (ISO 27001 A.8.16 monitoreo; A.8.9 inventario sin filtrar configuraciones).
 */
export async function health(_req: Request, res: Response): Promise<void> {
  const databaseUp = await pingDatabase();
  const body: HealthStatus = {
    status: databaseUp ? 'ok' : 'degraded',
    database: databaseUp ? 'up' : 'down',
    uptimeSeconds: Math.round(process.uptime()),
    version: config.version,
    serverTime: new Date().toISOString(),
  };
  res.status(databaseUp ? 200 : 503).json(body);
}

/** Estadísticas de conexiones en tiempo real (sólo administradores). */
export async function realtimeStats(_req: Request, res: Response): Promise<void> {
  res.status(200).json({ realtime: hub.stats() });
}
