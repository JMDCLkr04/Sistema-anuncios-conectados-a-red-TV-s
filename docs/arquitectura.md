# Arquitectura del sistema

## 1. Visión general

El sistema es un **monolito modular** con patrón **MVC**. Un único proceso
Node.js expone la API REST, el servidor WebSocket y (en modo producción) la
aplicación web compilada. La modularidad se logra por **capas y por módulo
funcional**, no por servicios separados: esto simplifica el despliegue en una
red local y mantiene un único contrato de datos.

```
┌───────────────────────────────────────────────────────────────────┐
│                         Red local (RFC 1918)                       │
│                                                                    │
│   Navegador admin ─┐                                               │
│   Navegador cliente├── HTTP/REST ──┐                               │
│   Pantalla física ─┘   WS/RFC6455 ─┤                               │
│                                     ▼                              │
│                        ┌──────────────────────────┐                │
│                        │   Monolito (Node.js)     │                │
│                        │  ┌────────────────────┐  │                │
│                        │  │ Express (MVC/HTTP) │  │                │
│                        │  ├────────────────────┤  │                │
│                        │  │ Hub WebSocket      │  │                │
│                        │  └─────────┬──────────┘  │                │
│                        └────────────┼─────────────┘                │
│                                     ▼                              │
│                          ┌────────────────────┐                    │
│                          │  PostgreSQL 16     │                    │
│                          │  (127.0.0.1:5432)  │                    │
│                          └────────────────────┘                    │
└───────────────────────────────────────────────────────────────────┘
```

## 2. Capas del backend (MVC)

Cada capa conoce solo a la inmediatamente inferior. Las reglas de negocio
**nunca** escriben SQL y los modelos **nunca** tocan HTTP.

| Capa | Carpeta | Responsabilidad |
| ---- | ------- | --------------- |
| Rutas (Router) | `server/src/routes` | Mapea `URL + verbo` → controlador. Aplica guardias de sesión/rol/red. |
| Controladores | `server/src/controllers` | Traduce HTTP ⇄ servicio. No contiene SQL ni reglas de negocio. |
| Servicios | `server/src/services` | Reglas de negocio, auditoría y emisión de eventos en tiempo real. Único punto de mutación. |
| Modelos | `server/src/models` | Acceso a datos: todo el SQL por entidad vive aquí. |
| Vistas/Presentadores | `server/src/views` | Convierte filas de la base en DTO; **excluye** campos sensibles. |
| Dominio | `server/src/domain` | Contrato compartido backend ⇄ frontend (tipos, urgencias, protocolo WS). |
| Infraestructura | `server/src/config`, `utils`, `middlewares`, `websocket` | Config validada, criptografía, red, errores, hub de tiempo real. |

### Flujo de una escritura (ejemplo: crear anuncio)

1. `routes/announcement.routes.ts` aplica `authenticate` → `requireRole('admin')`
   → `writeLimiter` → `validateBody(createAnnouncementSchema)`.
2. `controllers/announcement.controller.ts` obtiene el actor y el contexto de auditoría.
3. `services/announcement.service.ts` ejecuta la regla de negocio, registra en la
   bitácora y **notifica** al hub WebSocket.
4. `models/announcement.model.ts` escribe en PostgreSQL (dentro de una transacción).
5. `views/presenters.ts` convierte la fila en el DTO `Announcement`.
6. El hub difunde `announcement:upsert` a cada perfil según su privilegio.

## 3. Frontend (React + TypeScript)

También sigue MVC, con el estado controlado por *hooks*.

| Rol MVC | Carpeta | Contenido |
| ------- | ------- | --------- |
| Modelo | `client/src/models` | Tipos (re-exporta el dominio) y metadatos de presentación. |
| Servicios | `client/src/services` | Cliente HTTP (`http.ts`, `api.ts`) y cliente WebSocket (`websocket.ts`). |
| Controladores | `client/src/controllers` | Hooks: `useAuth`, `useAnnouncementFeed`, `useAnnouncements`, `useScreens`, `useUsers`, `useRotation`, … |
| Vistas | `client/src/views` | Componentes: `admin/*`, `viewer/*`, `display/*`, `shared/*`. |
| Router | `client/src/router` | Tabla de rutas y guardias `RequireAuth` con roles. |

Las vistas administrativas leen del **feed WebSocket** (`useAnnouncementFeed`) y
escriben mediante `useAnnouncements` (mutaciones HTTP). Así la interfaz nunca se
desincroniza: una alta se refleja a la vez en el panel y en las pantallas.

## 4. Contrato de datos compartido

Los tipos viven en `server/src/domain/` y el cliente los importa con `import type`:

```ts
// client/src/models/domain.ts
export type { Announcement, Priority, Screen, ClientMessage, ServerMessage } from '@domain';
```

- El alias `@domain` apunta a `server/src/domain/index.ts` (ver
  `client/tsconfig.json` → `paths` y `client/vite.config.ts`).
- Al ser `import type`, el compilador valida la forma de los datos pero **nada
  del código de servidor viaja al *bundle*** del navegador.
- Los metadatos de **presentación** (etiquetas, clases CSS, orden) se declaran en
  el cliente con `Record<Priority, …>`: si el backend añade una urgencia, el
  frontend **no compila** hasta tratarla. Esto evita la desincronización sin
  duplicar el contrato.

## 5. Tiempo real (WebSocket, RFC 6455)

El hub (`server/src/websocket/hub.ts`) sostiene el transporte WebSocket sobre el
**mismo puerto HTTP**, con las siguientes decisiones:

- **Handshake autenticado.** Se acepta la cookie de sesión (`sid`), un token de
  pantalla (`pnt_…`) o un JWT en `?token=`. El origen debe estar en la lista
  blanca (`WS_ALLOWED_ORIGINS`).
- **Perfiles.** Cada conexión se clasifica como `admin`, `client` o `screen`, y
  solo recibe lo que le corresponde (mínimo privilegio):
  - `admin`: todo, incluidos borradores, más eventos `audit:event` y `screen:seen`.
  - `client`: solo anuncios publicados y vigentes.
  - `screen`: solo lo publicado, vigente y dirigido a esa pantalla.
- **Latido.** Control frames `ping`/`pong` cada 30 s para cerrar conexiones zombis.
- **Recuperación.** Tras reconectar, el cliente pide `sync` y recibe el estado
  completo (`state`); no confía en su memoria.

Detalle de mensajes en [`api.md`](api.md).

## 6. Base de datos

`db/init.sql` define el esquema y se ejecuta automáticamente al crear el
contenedor (montado en `/docker-entrypoint-initdb.d`).

| Tabla | Propósito |
| ----- | --------- |
| `users` | Cuentas (`admin`/`client`), hash bcrypt, estado y último acceso. |
| `screens` | Pantallas registradas; solo el **SHA-256** del token. |
| `announcements` | Anuncios con urgencia, estado y ventana de publicación. |
| `announcement_screens` | Relación N:M; **0 filas = emitir en todas las pantallas**. |
| `audit_logs` | Bitácora de solo anexado (`append-only`). |

Además: la vista `active_announcements` (anuncios vigentes ordenados por
urgencia), el disparador `set_updated_at` y el rol `anuncios_app` con permisos
mínimos (sin `UPDATE`/`DELETE` sobre la bitácora).

## 7. Configuración

`server/src/config/env.ts` valida el entorno con Zod: si falta o es inválido, el
**proceso no arranca** en lugar de degradar la seguridad. En producción exige un
`JWT_SECRET` de ≥ 32 caracteres; en desarrollo genera una clave efímera y lo
advierte por consola.

## 8. Arranque y cierre

`server/src/server.ts`:

1. Crea la aplicación (`app.ts`) y adjunta el hub WebSocket.
2. Asegura la cuenta administradora inicial (`bootstrap.ts`).
3. Programa la expiración de anuncios cuya ventana terminó (`expireDue`).
4. Cierra de forma ordenada ante `SIGINT`/`SIGTERM` (deja de aceptar conexiones,
   cierra el hub y el pool de PostgreSQL).
