import { Router } from 'express';

import { adminRouter } from './admin.routes.js';
import { announcementRouter } from './announcement.routes.js';
import { authRouter } from './auth.routes.js';
import { healthController } from '../controllers/index.js';
import { screenRouter } from './screen.routes.js';

/**
 * Enrutador raíz de la API (`/api`). Mantiene el monolito modular: cada módulo
 * funcional (autenticación, anuncios, pantallas, administración) expone su
 * propio enrutador y aquí sólo se compone el árbol de rutas.
 */
export const apiRouter = Router();

// Diagnóstico: sin límite de tasa para no bloquear el monitoreo.
apiRouter.get('/health', healthController.health);

apiRouter.use('/auth', authRouter);
apiRouter.use('/announcements', announcementRouter);
apiRouter.use('/screens', screenRouter);
apiRouter.use('/', adminRouter); // /users, /audit, /realtime/stats
