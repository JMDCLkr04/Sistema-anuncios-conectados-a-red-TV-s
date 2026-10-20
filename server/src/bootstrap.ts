import { config } from './config/env.js';
import { logger } from './config/logger.js';
import * as userModel from './models/user.model.js';
import * as audit from './services/audit.service.js';
import { hashPassword } from './utils/crypto.js';
import { passwordSchema } from './validation/schemas.js';

/**
 * Abastecimiento inicial (bootstrap) de la cuenta administradora.
 *
 * ISO 27001 A.5.16/A.5.17: toda identidad debe existir antes de usarse y sus
 * credenciales deben cumplir la política. La operación es idempotente y queda
 * registrada en la bitácora; en producción la contraseña por defecto provoca un
 * aviso explícito para forzar su cambio.
 */
export async function ensureBootstrapAdmin(): Promise<void> {
  const { username, password } = config.bootstrapAdmin;

  const existing = await userModel.findByUsername(username);
  if (existing) {
    if (existing.role !== 'admin') {
      logger.error('La cuenta de arranque existe pero NO tiene rol admin', { username });
    }
    return;
  }

  const policy = passwordSchema.safeParse(password);
  if (!policy.success) {
    const detail = policy.error.issues.map((issue) => issue.message).join(' ');
    if (config.isProduction) {
      throw new Error(`ADMIN_PASSWORD no cumple la política de contraseñas: ${detail}`);
    }
    logger.warn('La contraseña de arranque no cumple la política; cámbiela antes de desplegar', {
      username,
      detail,
    });
  }

  const created = await userModel.create({
    username,
    passwordHash: await hashPassword(password),
    role: 'admin',
    active: true,
  });

  logger.warn('Cuenta administradora inicial creada. Cambie su contraseña.', { username });
  await audit.record(
    { username: 'sistema' },
    { action: 'user.bootstrap', entity: 'user', entityId: created.id, details: { username } },
  );
}
