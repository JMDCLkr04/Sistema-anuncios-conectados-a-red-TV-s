import { Router } from 'express';

import * as screenController from '../controllers/screen.controller.js';
import { authenticate, requirePrivateNetwork, requireRole } from '../middlewares/auth.js';
import { writeLimiter } from '../middlewares/rateLimit.js';
import { validateBody } from '../middlewares/validate.js';
import { screenInputSchema, screenUpdateSchema } from '../validation/schemas.js';

/**
 * RUTAS de pantallas (sólo administración).
 * `requirePrivateNetwork` materializa el requisito RFC 1918: el alta y la
 * gestión de dispositivos sólo se aceptan desde direcciones privadas.
 */
export const screenRouter = Router();

screenRouter.use(authenticate, requireRole('admin'), requirePrivateNetwork);

screenRouter.get('/', screenController.list);
screenRouter.post('/', writeLimiter, validateBody(screenInputSchema), screenController.create);
screenRouter.patch('/:id', writeLimiter, validateBody(screenUpdateSchema), screenController.update);
screenRouter.delete('/:id', screenController.remove);
screenRouter.post('/:id/rotate-token', writeLimiter, screenController.rotateToken);
