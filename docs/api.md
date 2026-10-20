# API REST y protocolo WebSocket

Base de la API: `/api`. Todas las respuestas son JSON. Las peticiones usan la
cookie de sesión (`httpOnly`, `SameSite=Strict`); también se acepta
`Authorization: Bearer <JWT>` para herramientas no navegador.

**Forma de error uniforme:**

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "…", "fields": { "title": "…" } } }
```

Códigos usados: `400 BAD_REQUEST`, `401 UNAUTHORIZED`, `403 FORBIDDEN`,
`404 NOT_FOUND`, `409 CONFLICT`, `429 TOO_MANY_REQUESTS`, `500 INTERNAL_ERROR`.

---

## 1. Diagnóstico

| Método | Ruta | Acceso | Respuesta |
| ------ | ---- | ------ | --------- |
| `GET` | `/health` | Público | `HealthStatus` (`200` o `503` si la base está caída) |

## 2. Autenticación

| Método | Ruta | Acceso | Descripción |
| ------ | ---- | ------ | ----------- |
| `POST` | `/auth/login` | Público (con límite de tasa) | Cuerpo `{ username, password }` → `AuthResponse` y cookie de sesión. |
| `POST` | `/auth/logout` | Público (idempotente) | Borra la cookie. `204`. |
| `GET` | `/auth/me` | Sesión | `{ user: SessionUser }`; valida que la cuenta siga activa. |

## 3. Anuncios

| Método | Ruta | Acceso | Descripción |
| ------ | ---- | ------ | ----------- |
| `GET` | `/announcements/active` | Sesión **o** token de pantalla (`?token=pnt_…`) | Feed vigente: `{ announcements, serverTime }`. Para una pantalla respeta su asignación. |
| `GET` | `/announcements` | Sesión | Listado con filtros `status`, `priority`, `search`, `limit` (≤ 200). `admin` recibe `scope:"all"`; `client`, `scope:"published"`. |
| `POST` | `/announcements` | `admin` | Crea un anuncio. `201` → `{ announcement }`. |
| `GET` | `/announcements/:id` | Sesión | `{ announcement }`. Un `client` solo puede ver los publicados. |
| `PUT` | `/announcements/:id` | `admin` | Reemplazo parcial/total → `{ announcement }`. |
| `PATCH` | `/announcements/:id` | `admin` | Igual que `PUT` para cambios parciales. |
| `DELETE` | `/announcements/:id` | `admin` | Elimina. `204`. |

**Cuerpo de escritura (`AnnouncementInput`):**

```json
{
  "title": "Simulacro de evacuación a las 11:00",
  "body": "Al escuchar la alarma, diríjase a la zona segura.",
  "priority": "critical",
  "status": "published",
  "startsAt": null,
  "endsAt": "2026-05-20T14:30:00.000Z",
  "screenIds": [],
  "allScreens": true
}
```

Reglas: `title` 3–160, `body` 3–4000, fechas ISO-8601 con `endsAt > startsAt`,
hasta 200 `screenIds`. `allScreens: true` (o `screenIds` vacío) emite en todas las
pantallas.

## 4. Pantallas (solo `admin` y red privada RFC 1918)

| Método | Ruta | Descripción |
| ------ | ---- | ----------- |
| `GET` | `/screens` | `{ screens, connectedScreenIds }` (telemetría de conexión). |
| `POST` | `/screens` | Alta → `{ screen: ScreenWithToken, connectionHint }`. |
| `PATCH` | `/screens/:id` | Edita nombre/ubicación/estado → `{ screen }`. |
| `DELETE` | `/screens/:id` | Elimina. `204`. |
| `POST` | `/screens/:id/rotate-token` | Revoca el token anterior y emite uno nuevo → `{ screen, connectionHint }`. |

`ScreenWithToken` incluye el token en claro (`pnt_…`) **solo en este momento**; el
servidor guarda su SHA-256. `connectionHint` es la URL lista para abrir en el
dispositivo: `<CLIENT_BASE_URL>/pantalla/<token>`.

## 5. Administración

| Método | Ruta | Descripción |
| ------ | ---- | ----------- |
| `GET` | `/users` | `{ users: UserSummary[] }`. |
| `POST` | `/users` | Alta de cuenta → `{ user }`. `201`. |
| `PATCH` | `/users/:id` | Rol, estado o contraseña → `{ user }`. |
| `DELETE` | `/users/:id` | Elimina. `204`. Impide eliminar al último `admin`. |
| `GET` | `/audit?limit=100` | `{ entries: AuditLogEntry[] }` (1–500). |
| `GET` | `/realtime/stats` | `{ realtime: { total, byKind, screens } }`. |

---

## 6. Protocolo WebSocket (RFC 6455)

- **URL:** `ws://<host>/ws` (o `wss://` con TLS). Mismo servidor y puerto que la
  API (el *upgrade* HTTP se atiende en la ruta `/ws`).
- **Handshake autenticado** (una de estas):
  - Cookie de sesión (`sid`) — navegador `admin`/`client`.
  - `?token=pnt_…` — token de una **pantalla**.
  - `?token=<JWT>` — usuario no navegador.
- **Origen** debe pertenecer a `WS_ALLOWED_ORIGINS`.
- **Tamaño máximo de mensaje:** 8 KiB. Solo texto JSON (las tramas binarias se ignoran).

### Envoltura

Todos los mensajes comparten la envoltura `{ "type": …, "payload": {…}, "ts": 1700000000000 }`.

### Mensajes del servidor

| `type` | `payload` | Destinatario |
| ------ | --------- | ------------ |
| `hello` | `{ connectionId, kind, serverTime, heartbeatSeconds }` | Al conectar. |
| `state` | `{ announcements, serverTime }` | Estado inicial/sincronización. |
| `announcement:upsert` | `{ announcement }` | Alta o cambio visible para el perfil. |
| `announcement:remove` | `{ id }` | Baja del anuncio. |
| `screen:seen` | `{ screenId, lastSeenAt }` | Solo `admin` (telemetría de pantallas). |
| `audit:event` | `{ action, username, createdAt }` | Solo `admin`. |
| `pong` | `{ ts }` | Respuesta a `ping`. |
| `error` | `{ code, message }` | Mensaje no reconocido o estado no disponible. |

### Mensajes del cliente

| `type` | `payload` | Efecto |
| ------ | --------- | ------ |
| `sync` | `{}` | Reenvía el estado completo (`state`). |
| `subscribe` | `{ screenId? }` | La propia pantalla confirma presencia. |
| `heartbeat` | `{ screenId? }` | La propia pantalla reporta último contacto. |
| `ping` | `{ ts }` | Devuelve `pong` con el mismo `ts`. |

### Ejemplo de sesión de una pantalla

```
cliente → ws://host/ws?token=pnt_xxx
servidor → {"type":"hello","payload":{"kind":"screen",…}}
servidor → {"type":"state","payload":{"announcements":[…],"serverTime":"…"}}
cliente → {"type":"sync","payload":{}}
… un administrador publica un anuncio …
servidor → {"type":"announcement:upsert","payload":{"announcement":{…}}}
```
