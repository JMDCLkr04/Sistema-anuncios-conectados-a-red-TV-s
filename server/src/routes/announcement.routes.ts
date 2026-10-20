import { Router } from 'express';

import * as announcementController from '../controllers/announcement.controller.js';
import { authenticate, authenticateScreenOrUser, requireRole } from '../middlewares/auth.js';
import { writeLimiter } from '../middlewares/rateLimit.js';
import { validateBody, validateQuery } from '../middlewares/validate.js';
import {
  createAnnouncementSchema,
  listQuerySchema,
  updateAnnouncementSchema,
} from '../validation/schemas.js';

/**
 * RUTAS de anuncios.
 *  - Lectura: cualquier sesión válida (admin ve todo; client sólo lo publicado).
 *  - Escritura: exclusiva de `admin` + límite de tasa + validación estricta.
 */
export const announcementRouter = Router();

// Feed de solo lectura: accesible por una sesión (admin/client) o por el token
// propio de una pantalla. Se registra ANTES del guard de sesión general.
announcementRouter.get('/active', authenticateScreenOrUser, announcementController.listActive);

announcementRouter.use(authenticate);

announcementRouter.get('/', validateQuery(listQuerySchema), announcementController.list);

announcementRouter.post(
  '/',
  requireRole('admin'),
  writeLimiter,
  validateBody(createAnnouncementSchema),
  announcementController.create,
);

announcementRouter.get('/:id', announcementController.getById);
announcementRouter.put(
  '/:id',
  requireRole('admin'),
  writeLimiter,
  validateBody(updateAnnouncementSchema),
  announcementController.update,
);
announcementRouter.patch(
  '/:id',
  requireRole('admin'),
  writeLimiter,
  validateBody(updateAnnouncementSchema),
  announcementController.update,
);
announcementRouter.delete('/:id', requireRole('admin'), announcementController.remove);
