import { Router } from 'express';

import { loginSchema } from '../validation/schemas.js';
import { validateBody } from '../middlewares/validate.js';
import { loginLimiter } from '../middlewares/rateLimit.js';
import { authenticate } from '../middlewares/auth.js';
import * as authController from '../controllers/auth.controller.js';

/**
 * RUTAS de autenticación (enrutador del MVC: mapea URL + verbo → controlador).
 * El login es la única puerta pública y está protegida con límite de tasa.
 */
export const authRouter = Router();

authRouter.post('/login', loginLimiter, validateBody(loginSchema), authController.login);
authRouter.post('/logout', authController.logout); // idempotente: no exige sesión
authRouter.get('/me', authenticate, authController.me);
