import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../../controllers/useAuth';
import { ROLE_VIEW } from '../../models';

/**
 * VISTA: marco de la aplicación (encabezado, navegación, contenido y pie).
 *
 * Accesibilidad (WCAG 2.2):
 *  - 2.4.1: enlace "Saltar al contenido principal" como primer elemento.
 *  - 2.4.2: cada ruta actualiza el título del documento.
 *  - 2.4.3: al cambiar de página el foco se mueve al `<main>`.
 *  - 1.3.1: regiones `header`/`nav`/`main`/`footer` con nombres accesibles.
 *  - 4.1.3: región `aria-live` que anuncia el cambio de página.
 */

const PAGE_TITLES: { match: RegExp; title: string }[] = [
  { match: /^\/$/, title: 'Inicio' },
  { match: /^\/login/, title: 'Iniciar sesión' },
  { match: /^\/vision/, title: 'Cartelera de anuncios' },
  { match: /^\/admin$/, title: 'Panel de administración' },
  { match: /^\/admin\/anuncios\/nuevo/, title: 'Nuevo anuncio' },
  { match: /^\/admin\/anuncios\/[^/]+\/editar/, title: 'Editar anuncio' },
  { match: /^\/admin\/anuncios/, title: 'Anuncios' },
  { match: /^\/admin\/pantallas/, title: 'Pantallas' },
  { match: /^\/admin\/cuentas/, title: 'Cuentas' },
  { match: /^\/admin\/bitacora/, title: 'Bitácora de auditoría' },
  { match: /^\/pantalla/, title: 'Pantalla de emisión' },
];

export function pageTitleFor(pathname: string): string {
  return PAGE_TITLES.find((entry) => entry.match.test(pathname))?.title ?? 'Recurso no encontrado';
}

export function AppLayout() {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const [routeAnnouncement, setRouteAnnouncement] = useState('');

  useEffect(() => {
    const title = pageTitleFor(location.pathname);
    document.title = `${title} · Sistema de anuncios`;
    setRouteAnnouncement(`Página cargada: ${title}.`);
    // Mueve el foco al contenido principal para que el teclado y los lectores
    // de pantalla no tengan que recorrer la navegación completa otra vez.
    mainRef.current?.focus();
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <a href="#contenido" className="skip-link">
        Saltar al contenido principal
      </a>

      <header className="no-print border-b-4 border-brand-700 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3">
          <p className="flex items-center gap-2 text-lg font-extrabold text-brand-900">
            <span aria-hidden="true" className="text-2xl">
              📢
            </span>
            Sistema de anuncios
          </p>

          {user && (
            <nav aria-label="Navegación principal">
              <ul className="flex flex-wrap items-center gap-1">
                {isAdmin ? (
                  <>
                    <li>
                      <NavLink to="/admin" end className="nav-link">
                        Resumen
                      </NavLink>
                    </li>
                    <li>
                      <NavLink to="/admin/anuncios" className="nav-link">
                        Anuncios
                      </NavLink>
                    </li>
                    <li>
                      <NavLink to="/admin/pantallas" className="nav-link">
                        Pantallas
                      </NavLink>
                    </li>
                    <li>
                      <NavLink to="/admin/cuentas" className="nav-link">
                        Cuentas
                      </NavLink>
                    </li>
                    <li>
                      <NavLink to="/admin/bitacora" className="nav-link">
                        Bitácora
                      </NavLink>
                    </li>
                    <li>
                      <NavLink to="/vision" className="nav-link">
                        Vista de pantalla
                      </NavLink>
                    </li>
                  </>
                ) : (
                  <li>
                    <NavLink to="/vision" className="nav-link">
                      Cartelera
                    </NavLink>
                  </li>
                )}
              </ul>
            </nav>
          )}

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <p className="text-sm text-slate-700">
                  <span className="font-bold text-brand-900">{user.username}</span>
                  <br />
                  <span>{ROLE_VIEW[user.role].label}</span>
                </p>
                <button type="button" className="btn btn--secondary" onClick={() => void logout()}>
                  Cerrar sesión
                </button>
              </>
            ) : (
              <Link to="/login" className="btn btn--primary">
                Iniciar sesión
              </Link>
            )}
          </div>
        </div>
      </header>

      <main
        id="contenido"
        ref={mainRef}
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl flex-1 px-4 py-6"
      >
        <Outlet />
      </main>

      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="route-announcer"
      >
        {routeAnnouncement}
      </div>

      <footer className="no-print border-t border-brand-200 bg-brand-50 py-4 text-sm text-slate-700">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-4">
          <p>MVP académico · Emisión de anuncios en red local (RFC 1918) sobre WebSocket (RFC 6455).</p>
          <p>Seguridad basada en ISO/IEC 27001 · Accesibilidad WCAG 2.2 nivel AA.</p>
        </div>
      </footer>
    </div>
  );
}
