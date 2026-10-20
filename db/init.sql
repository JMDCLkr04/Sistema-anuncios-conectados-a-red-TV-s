-- =====================================================================
--  Esquema de base de datos — Sistema de anuncios para pantallas (MVP)
--  Motor: PostgreSQL 16
--  Enfoque de seguridad: ISO/IEC 27001 (A.8.3 restricción de acceso,
--  A.8.9 gestión de configuración, A.8.15 registro de eventos,
--  A.5.33 protección de registros, A.5.34 privacidad).
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------
-- Roles y usuarios (modelo: User)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      VARCHAR(60)  NOT NULL UNIQUE,
    password_hash VARCHAR(120) NOT NULL,
    role          VARCHAR(10)  NOT NULL CHECK (role IN ('admin', 'client')),
    active        BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    last_login_at TIMESTAMPTZ,
    CONSTRAINT users_username_format CHECK (username ~ '^[a-zA-Z0-9._-]{3,60}$')
);

COMMENT ON TABLE  users IS 'Cuentas del sistema. admin = publica anuncios; client = solo observa.';
COMMENT ON COLUMN users.password_hash IS 'Hash bcrypt (coste 12). Nunca se almacena texto plano (ISO 27001 A.5.17).';

-- ---------------------------------------------------------------------
-- Pantallas (modelo: Screen) — dispositivos conectados a la WiFi local
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS screens (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         VARCHAR(80)  NOT NULL,
    location     VARCHAR(120) NOT NULL DEFAULT 'Sin ubicación',
    token_hash   VARCHAR(64)  NOT NULL UNIQUE, -- SHA-256 del token; el token en claro solo se muestra una vez
    active       BOOLEAN      NOT NULL DEFAULT TRUE,
    last_seen_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE  screens IS 'Pantallas registradas que consumen el feed vía WebSocket (RFC 6455).';
COMMENT ON COLUMN screens.token_hash IS 'SHA-256 del token de pantalla (ISO 27001 A.8.24 uso de criptografía).';

-- ---------------------------------------------------------------------
-- Anuncios (modelo: Announcement)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS announcements (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title      VARCHAR(160) NOT NULL CHECK (length(trim(title)) >= 3),
    body       TEXT         NOT NULL CHECK (length(trim(body)) >= 3),
    priority   VARCHAR(10)  NOT NULL DEFAULT 'normal'
                 CHECK (priority IN ('critical', 'high', 'normal', 'low')),
    status     VARCHAR(12)  NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft', 'published', 'expired')),
    starts_at  TIMESTAMPTZ,
    ends_at    TIMESTAMPTZ,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT announcements_window CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

COMMENT ON TABLE  announcements IS 'Contenido emitido hacia las pantallas. priority = urgencia (critical se resalta en rojo).';
COMMENT ON COLUMN announcements.status IS 'draft = borrador; published = visible; expired = ventana de publicación terminada.';

CREATE INDEX IF NOT EXISTS announcements_status_priority_idx
    ON announcements (status, priority, created_at DESC);

-- ---------------------------------------------------------------------
-- Asignación anuncio -> pantalla (0 filas = se emite en TODAS las pantallas)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS announcement_screens (
    announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    screen_id       UUID NOT NULL REFERENCES screens(id)       ON DELETE CASCADE,
    PRIMARY KEY (announcement_id, screen_id)
);

CREATE INDEX IF NOT EXISTS announcement_screens_screen_idx ON announcement_screens (screen_id);

-- ---------------------------------------------------------------------
-- Bitácora de auditoría (ISO 27001 A.8.15 registro de eventos)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id         BIGSERIAL PRIMARY KEY,
    user_id    UUID,
    username   VARCHAR(60),
    action     VARCHAR(60)  NOT NULL,
    entity     VARCHAR(40),
    entity_id  TEXT,
    outcome    VARCHAR(10)  NOT NULL DEFAULT 'success' CHECK (outcome IN ('success', 'failure')),
    ip         INET,
    user_agent TEXT,
    details    JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE audit_logs IS 'Registro inmutable de eventos de seguridad y cambios de contenido (append-only desde la aplicación).';

CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx     ON audit_logs (action);

-- ---------------------------------------------------------------------
-- Vista de anuncios vigentes (usada por el feed de pantallas)
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW active_announcements AS
SELECT a.*
FROM announcements a
WHERE a.status = 'published'
  AND (a.starts_at IS NULL OR a.starts_at <= now())
  AND (a.ends_at   IS NULL OR a.ends_at   >  now())
ORDER BY
    CASE a.priority
        WHEN 'critical' THEN 0
        WHEN 'high'     THEN 1
        WHEN 'normal'   THEN 2
        ELSE 3
    END,
    a.created_at DESC;

-- ---------------------------------------------------------------------
-- Disparador para mantener updated_at
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS announcements_set_updated_at ON announcements;
CREATE TRIGGER announcements_set_updated_at
    BEFORE UPDATE ON announcements
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- Principio de mínimo privilegio (ISO 27001 A.8.2 / A.8.3):
-- el rol de aplicación no es superusuario y no puede borrar la bitácora.
-- ---------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anuncios_app') THEN
        CREATE ROLE anuncios_app NOLOGIN;
    END IF;
END
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON announcements, announcement_screens, screens TO anuncios_app;
GRANT SELECT, UPDATE               ON users TO anuncios_app;
GRANT INSERT, SELECT               ON audit_logs TO anuncios_app;
GRANT USAGE, SELECT                ON ALL SEQUENCES IN SCHEMA public TO anuncios_app;
GRANT SELECT                       ON active_announcements TO anuncios_app;
-- Sin UPDATE/DELETE sobre audit_logs: bitácora de solo anexado.
