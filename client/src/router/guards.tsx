import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../controllers/useAuth';
import type { Role } from '../models/domain';
import { LoadingState } from '../views/shared/StatusMessage';

/**
 * CONTROLADOR de navegación: protege rutas según la sesión y el rol.
 *
 * Es el punto donde el frontend aplica el control de acceso (ISO 27001 A.5.15).
 * No sustituye la verificación del servidor: el backend vuelve a comprobar
 * sesión y rol en cada petición y en cada handshake WebSocket.
 */
export function RequireAuth({ children, roles }: { children: ReactNode; roles?: readonly Role[] }) {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <LoadingState label="Verificando la sesión…" />;
  }

  if (status !== 'authenticated' || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles && !roles.includes(user.role)) {
    return <ForbiddenView />;
  }

  return <>{children}</>;
}

/** VISTA: acceso denegado (403) con salida clara para el usuario. */
export function ForbiddenView() {
  const { user } = useAuth();
  return (
    <section aria-labelledby="forbidden-title" className="mx-auto max-w-2xl py-10">
      <div role="alert" className="rounded-lg border-2 border-urgent-200 bg-urgent-50 p-6">
        <h1 id="forbidden-title" className="text-2xl font-extrabold text-urgent-900">
          Acceso restringido
        </h1>
        <p className="mt-2 text-slate-800">
          Su rol actual (<strong>{user?.role ?? 'invitado'}</strong>) no permite abrir esta sección. Los
          anuncios se administran con el rol <strong>Administrador</strong>; el rol{' '}
          <strong>Observador</strong> sólo puede consultar lo publicado.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to="/vision" className="btn btn--primary">
            Ir a la cartelera
          </Link>
          <Link to="/" className="btn btn--secondary">
            Volver al inicio
          </Link>
        </div>
      </div>
    </section>
  );
}

/** VISTA: 404 accesible. */
export function NotFoundView() {
  return (
    <section aria-labelledby="notfound-title" className="mx-auto max-w-2xl py-10">
      <h1 id="notfound-title" className="text-2xl font-extrabold text-brand-900">
        No encontramos esta página
      </h1>
      <p className="mt-2 text-slate-800">
        La dirección solicitada no existe o fue movida. Verifique el enlace o regrese al inicio.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link to="/" className="btn btn--primary">
          Volver al inicio
        </Link>
        <Link to="/vision" className="btn btn--secondary">
          Ver anuncios
        </Link>
      </div>
    </section>
  );
}
