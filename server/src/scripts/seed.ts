import { closePool } from '../config/db.js';
import { config } from '../config/env.js';
import { logger } from '../config/logger.js';
import type { Priority, SessionUser } from '../domain/types.js';
import * as userModel from '../models/user.model.js';
import * as announcementModel from '../models/announcement.model.js';
import { ensureBootstrapAdmin } from '../bootstrap.js';
import * as announcementService from '../services/announcement.service.js';
import * as screenService from '../services/screen.service.js';
import * as audit from '../services/audit.service.js';
import { hashPassword } from '../utils/crypto.js';

/**
 * Datos de demostración (idempotente).
 * Ejecutar con:  npm run seed
 *
 * Crea: cuenta observadora, tres pantallas y un conjunto de anuncios que cubre
 * los cuatro niveles de urgencia y los tres estados del ciclo de vida.
 */
const DEMO_VIEWER = { username: 'observador', password: '1234' };
const DEMO_SCREENS = [
  { name: 'Recepción', location: 'Planta baja — acceso principal' },
  { name: 'Laboratorio 2', location: 'Segundo piso — ala norte' },
  { name: 'Comedor', location: 'Planta baja — área común' },
];

const DEMO_ANNOUNCEMENTS: {
  title: string;
  body: string;
  priority: Priority;
  status: 'draft' | 'published';
  offsets?: { startsAt?: number; endsAt?: number };
}[] = [
  {
    title: 'Simulacro de evacuación a las 11:00',
    body:
      'El simulacro iniciará a las 11:00. Al escuchar la alarma, diríjase a la zona segura del estacionamiento sin usar los ascensores.',
    priority: 'critical',
    status: 'published',
    offsets: { endsAt: 8 * 60 * 60_000 },
  },
  {
    title: 'Mantenimiento del sistema de anuncios',
    body:
      'El martes entre 18:00 y 19:00 las pantallas se reiniciarán de forma programada. No se requiere acción de su parte.',
    priority: 'high',
    status: 'published',
    offsets: { startsAt: -24 * 60 * 60_000, endsAt: 5 * 24 * 60 * 60_000 },
  },
  {
    title: 'Menú del comedor — semana actual',
    body: 'Lunes: sopa de verduras. Martes: pollo al horno. Miércoles: pasta primavera. Jueves: pescado. Viernes: vegetariano.',
    priority: 'normal',
    status: 'published',
  },
  {
    title: 'Recordatorio: registro de asistencia',
    body: 'Recuerde registrar su asistencia antes de las 09:30 mediante el lector del acceso principal.',
    priority: 'low',
    status: 'published',
  },
  {
    title: 'Feria de ciencias — inscripciones abiertas',
    body: 'La inscripción para la feria de ciencias cierra el viernes. Consulte las bases en la coordinación académica.',
    priority: 'normal',
    status: 'draft',
  },
];

async function main(): Promise<void> {
  logger.info('Iniciando carga de datos de demostración…');
  await ensureBootstrapAdmin();

  const admin = await userModel.findByUsername(config.bootstrapAdmin.username);
  if (!admin) throw new Error('No existe la cuenta administradora; importe primero el esquema SQL.');

  const actor: SessionUser = { id: admin.id, username: admin.username, role: 'admin' };
  const context = { userId: admin.id, username: admin.username, ip: '127.0.0.1', userAgent: 'seed-script' };

  /* ---------------- Cuenta observadora (rol client) ---------------- */
  const viewer = await userModel.findByUsername(DEMO_VIEWER.username);
  if (!viewer) {
    await userModel.create({
      username: DEMO_VIEWER.username,
      passwordHash: await hashPassword(DEMO_VIEWER.password),
      role: 'client',
      active: true,
    });
    logger.info('Cuenta observadora creada', { username: DEMO_VIEWER.username });
  } else {
    await userModel.update(viewer.id, {
      passwordHash: await hashPassword(DEMO_VIEWER.password),
    });
    logger.info('Contraseña de la cuenta observadora actualizada', { username: DEMO_VIEWER.username });
  }

  /* ------------------------- Pantallas ---------------------------- */
  const existingScreens = await screenService.list();
  const issuedTokens: { name: string; token: string }[] = [];

  for (const demo of DEMO_SCREENS) {
    if (existingScreens.some((screen) => screen.name === demo.name)) continue;
    const { token } = await screenService.create({ ...demo, active: true }, actor, context);
    issuedTokens.push({ name: demo.name, token });
  }

  /* --------------------------- Anuncios --------------------------- */
  const existing = await announcementModel.list({ limit: 1 });
  if (existing.length === 0) {
    for (const demo of DEMO_ANNOUNCEMENTS) {
      const now = Date.now();
      await announcementService.create(
        {
          title: demo.title,
          body: demo.body,
          priority: demo.priority,
          status: demo.status,
          startsAt: demo.offsets?.startsAt ? new Date(now + demo.offsets.startsAt).toISOString() : null,
          endsAt: demo.offsets?.endsAt ? new Date(now + demo.offsets.endsAt).toISOString() : null,
          screenIds: [],
          allScreens: true,
        },
        actor,
        context,
      );
    }
    logger.info('Anuncios de demostración creados', { total: DEMO_ANNOUNCEMENTS.length });
  } else {
    logger.info('Ya existen anuncios; no se insertaron datos de demostración.');
  }

  await audit.record(context, { action: 'seed.run', entity: 'system', details: { screens: issuedTokens.length } });

  /* ---------------------------- Resumen --------------------------- */
  const banner = [
    '',
    '============================================================',
    ' Datos de demostración listos',
    '============================================================',
    ` Administrador : ${config.bootstrapAdmin.username} / ${config.bootstrapAdmin.password}`,
    ` Observador    : ${DEMO_VIEWER.username} / ${DEMO_VIEWER.password}`,
    ` Panel admin   : ${config.clientBaseUrl}/admin`,
    ` Vista cliente : ${config.clientBaseUrl}/vision`,
    '',
  ];
  for (const screen of issuedTokens) {
    banner.push(` Pantalla "${screen.name}" (token se muestra una sola vez):`);
    banner.push(`   ${config.clientBaseUrl}/pantalla/${screen.token}`);
  }
  if (issuedTokens.length === 0) {
    banner.push(' Las pantallas ya estaban creadas; use "Rotar token" en el panel si perdió el enlace.');
  }
  banner.push('============================================================', '');
  process.stdout.write(`${banner.join('\n')}\n`);
}

main()
  .then(async () => {
    await closePool();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    logger.error('Fallo la carga de datos de demostración', {
      error: error instanceof Error ? error.message : String(error),
    });
    await closePool().catch(() => undefined);
    process.exit(1);
  });
