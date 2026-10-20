import fs from 'node:fs';
import path from 'node:path';

import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import type { Express, NextFunction, Request, Response } from 'express';

import { config, PROJECT_ROOT } from './config/env.js';
import { logger } from './config/logger.js';
import { errorHandler, notFoundHandler } from './middlewares/error.js';
import { apiLimiter } from './middlewares/rateLimit.js';
import { requestContext } from './middlewares/requestLog.js';
import { apiRouter } from './routes/index.js';
import { isAllowedOrigin } from './utils/network.js';

/**
 * Construcción de la aplicación Express (VISTA/HTTP del monolito).
 *
 * Medidas de seguridad aplicadas (ISO 27001, Anexo A):
 *  - A.8.20/A.8.22: cabeceras de seguridad y CORS restringido a la LAN.
 *  - A.8.23: filtrado web (política de contenido CSP).
 *  - A.8.24: transporte cifrado (HSTS cuando se despliega con TLS).
 *  - A.8.26: cuerpo de petición acotado y validado.
 *  - A.8.11/A.5.34: sin datos sensibles en respuestas ni en caché.
 */
const CLIENT_DIST = path.join(PROJECT_ROOT, 'client', 'dist');

export function createApp(): Express {
  const app = express();

  // Detrás de N proxies confiables se toma la IP real del cliente.
  app.set('trust proxy', config.trustedProxyHops);
  app.disable('x-powered-by'); // no revelar tecnología (A.8.9)
  app.set('etag', false);

  /* ----------------------------- Seguridad ----------------------------- */
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          // Tailwind genera hojas estáticas; 'unsafe-inline' queda acotado a
          // atributos `style` de React (no habilita scripts en línea).
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:'],
          'font-src': ["'self'"],
          // WebSocket del propio origen y del host privado de la LAN.
          'connect-src': ["'self'", 'ws:', 'wss:'],
          'object-src': ["'none'"],
          'base-uri': ["'self'"],
          'form-action': ["'self'"],
          'frame-ancestors': ["'none'"],
          'manifest-src': ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: 'no-referrer' },
      hsts: config.isProduction
        ? { maxAge: 31_536_000, includeSubDomains: true, preload: false }
        : false,
    }),
  );

  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    next();
  });

  // CORS: sólo orígenes declarados de la red local (RFC 1918).
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) {
          callback(null, true); // peticiones same-origin o herramientas locales
          return;
        }
        const { allowed } = isAllowedOrigin(origin, config.corsOrigins);
        if (allowed) {
          callback(null, true);
          return;
        }
        logger.warn('Petición CORS bloqueada', { origin });
        callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      maxAge: 600,
    }),
  );

  /* --------------------------- Parsers/Cuerpo --------------------------- */
  app.use(express.json({ limit: '64kb' }));
  app.use(cookieParser());
  app.use(requestContext);

  /* ------------------------------- API -------------------------------- */
  app.use(
    '/api',
    (req: Request, res: Response, next: NextFunction) => {
      // Las respuestas de la API nunca se cachean en proxies intermedios.
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
      next();
    },
    apiLimiter,
    apiRouter,
  );

  /* --------------------- Aplicación web (SPA) ------------------------- */
  const spaIndex = path.join(CLIENT_DIST, 'index.html');
  if (fs.existsSync(spaIndex)) {
    app.use(
      express.static(CLIENT_DIST, {
        index: false,
        setHeaders(res, filePath) {
          if (filePath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-store');
          } else {
            // Los assets llevan hash en el nombre: cacheables de forma inmutable.
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      }),
    );
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/ws')) {
        next();
        return;
      }
      res.setHeader('Cache-Control', 'no-store');
      res.sendFile(spaIndex, (error) => {
        if (error) next(error);
      });
    });
  } else {
    app.get('/', (_req: Request, res: Response) => {
      res.status(200).json({
        name: 'Sistema de anuncios para pantallas (MVP)',
        hint: 'El frontend no está compilado. Ejecute `npm run build` o use el servidor de desarrollo de Vite.',
      });
    });
  }

  /* ------------------------- Manejo de errores ------------------------ */
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
