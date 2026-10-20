import { z } from 'zod';

import { ANNOUNCEMENT_STATUSES, PRIORITIES, ROLES } from '../domain/priorities.js';
import { PASSWORD_MIN_LENGTH } from '../utils/crypto.js';

/**
 * Validación de entradas con Zod (ISO 27001 A.8.26 requisitos de seguridad de
 * las aplicaciones, A.8.28 codificación segura). Toda entrada externa pasa por
 * aquí antes de tocar la base de datos: nunca se concatenan valores en SQL.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})?$/;

export const uuidSchema = z.string().trim().regex(UUID_RE, 'Identificador con formato inválido.');

export const isoDateTimeSchema = z
  .string()
  .trim()
  .regex(ISO_DATE_TIME_RE, 'Use una fecha ISO-8601, por ejemplo 2026-05-20T14:30.')
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Fecha inexistente en el calendario.');

const usernameSchema = z
  .string()
  .trim()
  .min(3, 'El usuario debe tener al menos 3 caracteres.')
  .max(60, 'El usuario no puede exceder 60 caracteres.')
  .regex(/^[a-zA-Z0-9._-]+$/, 'Solo se permiten letras, números, punto, guion y guion bajo.');

/** Política de contraseñas alineada a ISO 27001 A.5.17 (longitud + variedad). */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`)
  .max(128, 'La contraseña no puede exceder 128 caracteres.')
  .refine((value) => /[a-z]/.test(value), 'Debe incluir al menos una letra minúscula.')
  .refine((value) => /[A-Z]/.test(value), 'Debe incluir al menos una letra mayúscula.')
  .refine((value) => /\d/.test(value), 'Debe incluir al menos un dígito.')
  .refine((value) => /[^A-Za-z0-9]/.test(value), 'Debe incluir al menos un símbolo.');

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Ingrese su usuario.').max(60),
  password: z.string().min(1, 'Ingrese su contraseña.').max(128),
});

export const createUserSchema = z
  .object({
    username: usernameSchema,
    password: passwordSchema,
    role: z.enum(ROLES),
    active: z.boolean().optional(),
  })
  .transform((data) => ({ ...data, active: data.active ?? true }));

export const updateUserSchema = z.object({
  active: z.boolean().optional(),
  role: z.enum(ROLES).optional(),
  password: passwordSchema.optional(),
});

const announcementBase = {
  title: z
    .string()
    .trim()
    .min(3, 'El título debe tener al menos 3 caracteres.')
    .max(160, 'El título no puede exceder 160 caracteres.'),
  body: z
    .string()
    .trim()
    .min(3, 'El contenido debe tener al menos 3 caracteres.')
    .max(4000, 'El contenido no puede exceder 4000 caracteres.'),
  priority: z.enum(PRIORITIES),
  status: z.enum(ANNOUNCEMENT_STATUSES),
  startsAt: isoDateTimeSchema.nullable().optional(),
  endsAt: isoDateTimeSchema.nullable().optional(),
  screenIds: z.array(uuidSchema).max(200, 'Demasiadas pantallas seleccionadas.').optional(),
  allScreens: z.boolean().optional(),
};

function refineWindow<T extends { startsAt?: string | null; endsAt?: string | null }>(
  value: T,
  ctx: z.RefinementCtx,
): void {
  const { startsAt, endsAt } = value;
  if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) {
    ctx.addIssue({
      code: 'custom',
      path: ['endsAt'],
      message: 'La fecha de fin debe ser posterior a la fecha de inicio.',
    });
  }
}

export const createAnnouncementSchema = z
  .object(announcementBase)
  .superRefine(refineWindow)
  .transform((data) => ({
    title: data.title,
    body: data.body,
    priority: data.priority,
    status: data.status,
    startsAt: data.startsAt ?? null,
    endsAt: data.endsAt ?? null,
    screenIds: data.screenIds ?? [],
    allScreens: data.allScreens ?? (data.screenIds ?? []).length === 0,
  }));

export const updateAnnouncementSchema = z
  .object({
    title: announcementBase.title.optional(),
    body: announcementBase.body.optional(),
    priority: announcementBase.priority.optional(),
    status: announcementBase.status.optional(),
    startsAt: isoDateTimeSchema.nullable().optional(),
    endsAt: isoDateTimeSchema.nullable().optional(),
    screenIds: announcementBase.screenIds,
    allScreens: z.boolean().optional(),
  })
  .superRefine(refineWindow);

export const screenInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'El nombre de la pantalla es obligatorio.')
    .max(80, 'El nombre no puede exceder 80 caracteres.'),
  location: z
    .string()
    .trim()
    .max(120, 'La ubicación no puede exceder 120 caracteres.')
    .optional()
    .transform((value) => value ?? 'Sin ubicación'),
  active: z.boolean().optional().transform((value) => value ?? true),
});

export const screenUpdateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'El nombre de la pantalla es obligatorio.')
    .max(80, 'El nombre no puede exceder 80 caracteres.')
    .optional(),
  location: z
    .string()
    .trim()
    .max(120, 'La ubicación no puede exceder 120 caracteres.')
    .optional(),
  active: z.boolean().optional(),
});

export const listQuerySchema = z.object({
  status: z.enum(ANNOUNCEMENT_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  search: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;
export type ScreenInput = z.infer<typeof screenInputSchema>;
export type ScreenUpdateInput = z.infer<typeof screenUpdateSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;

/** Convierte el error de Zod en un mapa `campo → mensaje` legible. */
export function toFieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form';
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}
