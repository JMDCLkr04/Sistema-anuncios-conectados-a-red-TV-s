/**
 * MODELO del frontend.
 *
 * El contrato de datos se toma del dominio compartido del monolito
 * (`server/src/domain`). Se importa siempre con `import type` / `export type`
 * para que TypeScript lo valide en compilación y no viaje código de servidor
 * al bundle del navegador.
 */
export type {
  Announcement,
  AnnouncementInput,
  AnnouncementStatus,
  ApiErrorBody,
  AuditLogEntry,
  AuthResponse,
  ClientKind,
  ClientMessage,
  ClientMessageMap,
  HealthStatus,
  Priority,
  Role,
  Screen,
  ScreenInput,
  ScreenWithToken,
  ServerMessage,
  ServerMessageMap,
  SessionUser,
  UserSummary,
} from '@domain';
