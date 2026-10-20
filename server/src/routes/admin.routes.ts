import { Router } from 'express';

import * as authController from '../controllers/auth.controller.js';
import * as healthController from '../controllers/health.controller.js';
import { authenticate, requirePrivateNetwork, requireRole } from '../middlewares/auth.js';
import { writeLimiter } from '../middlewares/rateLimit.js';
import { validateBody } from '../middlewares/validate.js';
import { createUserSchema, updateUserSchema, uuidSchema } from '../validation/schemas.js';
import { badRequest } from '../utils/errors.js';

/**
 * RUTAS de administración: cuentas, bitácora y telemetría del tiempo real.
 * Todo el enrutador exige rol `admin` (ISO 27001 A.8.2 acceso privilegiado).
 */
export const adminRouter = Router();

// El guard se limita a los prefijos administrados: así una ruta de API
// desconocida cae en el 404 uniforme en vez de responder 401.
adminRouter.use(
  ['/users', '/audit', '/realtime'],
  authenticate,
  requireRole('admin'),
  requirePrivateNetwork,
);

/* Cuentas */
adminRouter.get('/users', authController.listUsers);
adminRouter.post('/users', writeLimiter, validateBody(createUserSchema), authController.createUser);

/** Valida el UUID de la ruta antes de llegar al controlador. */
adminRouter.param('id', (req, _res, next, value: string) => {
  const result = uuidSchema.safeParse(value);
  next(result.success ? undefined : badRequest('El identificador de la cuenta no es válido.'));
});

adminRouter.patch('/users/:id', writeLimiter, validateBody(updateUserSchema), authController.updateUser);
adminRouter.delete('/users/:id', authController.deleteUser);

/* Bitácora y monitoreo */
adminRouter.get('/audit', authController.listAuditLogs);
adminRouter.get('/realtime/stats', healthController.realtimeStats);
