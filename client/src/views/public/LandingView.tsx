import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../controllers/useAuth';
import type { HealthStatus } from '../../models/domain';
import { systemApi } from '../../services/api';

/**
 * VISTA: portada pública.
 * Explica el sistema y su modo de uso; consulta el estado del servicio con el
 * endpoint de diagnóstico (información no sensible).
 */
export function LandingView() {
  const { status, user } = useAuth();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthError, setHealthError] = useState(false);

  useEffect(() => {
    let active = true;
    systemApi
      .health()
      .then((result) => {
        if (active) setHealth(result);
      })
      .catch(() => {
        if (active) setHealthError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const target = user ? (user.role === 'admin' ? '/admin' : '/vision') : '/login';

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="hero-title" className="grid gap-6 md:grid-cols-[2fr_1fr]">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-brand-700">
            Red local · ISO 27001 · WCAG 2.2
          </p>
          <h1 id="hero-title" className="mt-2 text-4xl font-extrabold leading-tight text-brand-900">
            Anuncios institucionales para todas las pantallas de la red
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-700">
            Un solo punto de publicación envía el contenido a cada pantalla conectada a la red WiFi local
            mediante WebSocket (RFC 6455). Los administradores crean y programan anuncios; el resto de
            usuarios únicamente los observa.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to={target} className="btn btn--primary">
              {user ? 'Ir al panel' : 'Iniciar sesión'}
            </Link>
            {status === 'authenticated' && (
              <Link to="/vision" className="btn btn--secondary">
                Ver la cartelera
              </Link>
            )}
          </div>
        </div>

        <aside
          aria-labelledby="health-title"
          className="h-fit rounded-xl border-2 border-brand-200 bg-brand-50 p-5"
        >
          <h2 id="health-title" className="text-lg font-bold text-brand-900">
            Estado del servicio
          </h2>
          <div role="status" aria-live="polite" className="mt-3 text-slate-800">
            {healthError && <p className="font-semibold text-urgent-800">No se pudo consultar el servicio.</p>}
            {!health && !healthError && <p>Consultando…</p>}
            {health && (
              <ul className="space-y-1">
                <li>
                  <strong>Servicio:</strong> {health.status === 'ok' ? 'operativo' : 'degradado'}
                </li>
                <li>
                  <strong>Base de datos:</strong> {health.database === 'up' ? 'conectada' : 'sin conexión'}
                </li>
                <li>
                  <strong>Versión:</strong> {health.version}
                </li>
                <li>
                  <strong>En línea:</strong> {Math.floor(health.uptimeSeconds / 60)} min
                </li>
              </ul>
            )}
          </div>
        </aside>
      </section>

      <section aria-labelledby="how-title">
        <h2 id="how-title" className="text-2xl font-extrabold text-brand-900">
          Cómo funciona
        </h2>
        <ol className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            {
              title: '1. Alguien publica',
              body: 'El administrador redacta el anuncio, elige su urgencia y, si hace falta, programa el inicio y el fin.',
            },
            {
              title: '2. El servidor difunde',
              body: 'El monolito guarda el anuncio en PostgreSQL y lo empuja por WebSocket a las pantallas de la red local.',
            },
            {
              title: '3. Las pantallas muestran',
              body: 'Cada pantalla abre su enlace /pantalla/<token> y rota los anuncios vigentes; la urgencia crítica se resalta en rojo.',
            },
          ].map((step) => (
            <li key={step.title} className="rounded-xl border border-brand-200 p-4">
              <h3 className="font-bold text-brand-900">{step.title}</h3>
              <p className="mt-1 text-slate-700">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="scope-title" className="rounded-xl border border-brand-200 p-5">
        <h2 id="scope-title" className="text-xl font-bold text-brand-900">
          Alcance de este prototipo
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-6 text-slate-700">
          <li>Monolito modular con patrón MVC: un proceso sirve la API REST, el WebSocket y la interfaz React.</li>
          <li>Base de datos relacional PostgreSQL con bitácora de auditoría de sólo anexado.</li>
          <li>Control de acceso basado en roles (administrador / observador) y pantallas con token propio.</li>
          <li>Contenido accesible: navegación por teclado, contraste AA, mensajes de estado y control de pausa.</li>
        </ul>
      </section>
    </div>
  );
}
