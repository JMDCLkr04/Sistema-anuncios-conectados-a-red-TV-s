# Sistema de anuncios para pantallas en red local (MVP)

Monolito modular con patrón **MVC** para emitir anuncios hacia pantallas
conectadas a una red WiFi local (RFC 1918). El **administrador** publica; el
**cliente/observador** solo consulta; cada **pantalla** física consume el feed en
tiempo real por WebSocket (RFC 6455).

- **Backend:** Node.js + Express 5 (ESM) + WebSocket (`ws`) + PostgreSQL 16.
- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS v4.
- **Seguridad:** lineamientos ISO/IEC 27001 (2022). Ver [`docs/iso27001.md`](docs/iso27001.md).
- **Accesibilidad:** WCAG 2.2 nivel AA. Ver [`docs/wcag.md`](docs/wcag.md).

> Es un **prototipo académico**, no un sistema listo para producción. Las
> decisiones de seguridad y accesibilidad están documentadas y acotadas al MVP.

---

## 1. Requisitos previos

- Node.js ≥ 20.11 (probado con Node 22).
- Docker Desktop con `docker compose` (para PostgreSQL).
- Navegador moderno.

## 2. Puesta en marcha

```bash
# 1) Dependencias (npm workspaces en la raíz)
npm install

# 2) Configuración: copia la plantilla y ajústala
copy .env.example .env      # Windows
# cp .env.example .env      # Linux/macOS

# 3) Base de datos (PostgreSQL 16 en 127.0.0.1:5432)
npm run db:up

# 4) Datos de demostración (crea admin, observador, pantallas y anuncios)
npm run seed

# 5) Entorno de desarrollo (API + Vite en paralelo)
npm run dev
```

- Frontend (Vite): <http://localhost:5173>
- API + WebSocket: <http://localhost:4000> · `ws://localhost:4000/ws`

### Acceso desde un televisor o dispositivo de la red local

Para que una pantalla reciba los anuncios en tiempo real, el dispositivo debe
abrir el enlace de pantalla, no la raíz del sitio. El enlace incluye el token
de la pantalla y se genera desde **Administración → Pantallas**:

1. Inicie el servicio en la computadora administradora con `npm run dev`.
2. En `/admin/pantallas`, cree una pantalla o use **Rotar token** y copie el
   `connectionHint` mostrado.
3. Abra ese enlace en el televisor, por ejemplo:
   `http://192.168.100.38:5173/pantalla/<token>`.
4. Publique el anuncio desde `/admin/anuncios`. La pantalla lo recibirá sin
   actualizar la página mediante WebSocket.

La computadora y el televisor deben estar conectados a la misma red WiFi, y el
firewall de Windows debe permitir conexiones entrantes para Node.js en los
puertos `5173` (Vite) y `4000` (API/WebSocket). Si la IP privada de la
computadora cambia, actualice `PUBLIC_BASE_URL`, `CLIENT_BASE_URL`,
`CORS_ORIGINS` y `WS_ALLOWED_ORIGINS` en `.env`, reinicie `npm run dev` y
genere un nuevo enlace desde el panel. La raíz
`http://192.168.100.38:5173` sólo muestra la portada; `/vision` es la
cartelera autenticada para usuarios observadores.

### Credenciales de demostración

| Rol          | Usuario      | Contraseña               | Acceso                        |
| ------------ | ------------ | ------------------------ | ----------------------------- |
| Administrador | `admin`     | `Admin2026!Cambiame`     | `/admin` (CRUD completo)      |
| Observador   | `observador` | `1234`                   | `/vision` (solo lectura)      |

El `seed` también imprime en consola los **tokens de las pantallas** (se muestran
una única vez). El enlace de una pantalla es `/pantalla/<token>`.

## 3. Scripts

| Script              | Descripción                                                      |
| ------------------- | ---------------------------------------------------------------- |
| `npm run dev`       | Levanta API y frontend (Vite) en paralelo.                       |
| `npm run build`     | Compila el frontend (`client/dist`) y el backend (`server/dist`).|
| `npm start`         | Sirve el monolito compilado (API + SPA) en un solo puerto.       |
| `npm run typecheck` | Verificación de tipos del servidor y del cliente.                |
| `npm run db:up`     | Inicia PostgreSQL con Docker Compose.                            |
| `npm run db:down`   | Detiene PostgreSQL (conserva los datos).                         |
| `npm run db:reset`  | Recrea la base de datos desde cero (borra el volumen).           |
| `npm run seed`      | Carga datos de demostración e imprime los tokens de pantalla.    |

## 4. Roles y superficies

| Superficie            | Ruta                      | Quién       | Qué hace                                             |
| --------------------- | ------------------------- | ----------- | ---------------------------------------------------- |
| Portada               | `/`                       | Público     | Presentación del sistema.                            |
| Inicio de sesión      | `/login`                  | Público     | Autenticación (cookie httpOnly + JWT).               |
| Cartelera (observador)| `/vision`                 | `client`    | Solo lectura de anuncios publicados y vigentes.      |
| Panel de administración| `/admin/**`              | `admin`     | Anuncios, pantallas, cuentas y bitácora.             |
| Pantalla física       | `/pantalla/:token`        | Dispositivo | Rotación automática de anuncios a pantalla completa. |

En el panel: `/admin` (resumen), `/admin/anuncios`, `/admin/anuncios/nuevo`,
`/admin/anuncios/:id/editar`, `/admin/pantallas`, `/admin/cuentas`,
`/admin/bitacora`.

## 5. Estructura del repositorio

```
proyecto_titulacion/
├─ server/                     Backend (MVC)
│  └─ src/
│     ├─ domain/               Contrato compartido (tipos, urgencias, protocolo WS)
│     ├─ config/               Entorno validado, logger, pool de PostgreSQL
│     ├─ models/               Acceso a datos (SQL por entidad)
│     ├─ services/             Reglas de negocio + auditoría + notificación WS
│     ├─ controllers/          Traducción HTTP ⇄ servicio
│     ├─ routes/               Tabla de rutas (URL + verbo → controlador)
│     ├─ middlewares/          Auth, validación, límite de tasa, errores, bitácora
│     ├─ views/                Presentadores (entidad → DTO sin campos sensibles)
│     ├─ websocket/            Hub RFC 6455 (handshake, difusión, latido)
│     ├─ validation/           Esquemas Zod de entrada
│     └─ utils/                Criptografía, errores, red (RFC 1918)
├─ client/                     Frontend (React + TS)
│  └─ src/
│     ├─ models/               Tipos (re-exporta el dominio) y presentación
│     ├─ services/             HTTP y WebSocket
│     ├─ controllers/          Hooks con la lógica de cada pantalla
│     ├─ views/                Componentes de UI (admin, visor, pantalla, shared)
│     ├─ router/               Rutas y guardias de rol
│     └─ styles/global.css     Tema (verde/blanco/rojo), contrastes y componentes
├─ db/init.sql                 Esquema, índice, vista y permisos mínimos
├─ docker-compose.yml          PostgreSQL 16 (expuesto solo en loopback)
└─ docs/                       Arquitectura, seguridad, accesibilidad y API
```

## 6. Documentación

- [Arquitectura](docs/arquitectura.md) — capas, MVC, flujo de datos y contrato compartido.
- [Seguridad (ISO 27001)](docs/iso27001.md) — matriz de controles del Anexo A aplicados.
- [Accesibilidad (WCAG 2.2 AA)](docs/wcag.md) — matriz de criterios y su implementación.
- [API y protocolo WebSocket](docs/api.md) — endpoints REST y mensajes del feed.

## 7. Alcance y limitaciones del MVP

- Un único proceso servidor (monolito); no hay alta disponibilidad ni balanceo.
- PostgreSQL expuesto solo en `127.0.0.1`; pensado para la red local, no para Internet.
- Sin TLS por defecto (se asume despliegue en red privada); en producción, la
  cookie de sesión exige `Secure` (HTTPS) y `HSTS` se activa automáticamente.
- Los tokens de pantalla se muestran una sola vez; el servidor almacena solo su SHA-256.
