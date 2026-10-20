import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useAnnouncementFeed } from '../../controllers/useAnnouncementFeed';
import { usePrefersReducedMotion, useRotation } from '../../controllers/useRotation';
import { PRIORITY_VIEW, formatDateTime, formatTime, isLive } from '../../models';
import { PriorityBadge } from '../shared/PriorityBadge';

/**
 * VISTA: pantalla de emisión (dispositivo conectado a la red WiFi local).
 *
 * Diseño y accesibilidad (WCAG 2.2):
 *  - Superficie oscura con texto blanco: contraste ≥ 7:1 (1.4.3 / 1.4.6).
 *  - Criterio 2.2.2: la rotación automática puede pausarse con un botón visible
 *    y también con la tecla `Espacio`; además hay navegación manual.
 *  - Criterio 1.4.1: la urgencia crítica añade borde rojo, icono y la palabra
 *    "Crítico"; nunca depende sólo del color.
 *  - Criterio 2.3.3: si el sistema pide "movimiento reducido", la rotación
 *    arranca pausada.
 *  - Criterio 2.4.3: la región que rota no recibe el foco; los controles sí,
 *    y están siempre visibles.
 */
const ROTATION_MS = 12_000;

export function DisplayView() {
  const { token = '' } = useParams<{ token: string }>();
  const reducedMotion = usePrefersReducedMotion();
  const { announcements, error, loading, socketStatus, lastSyncAt } = useAnnouncementFeed({
    mode: 'screen',
    screenToken: token,
  });

  const [paused, setPaused] = useState(false);

  // Arranca pausado cuando el sistema operativo declara movimiento reducido.
  useEffect(() => {
    setPaused(reducedMotion);
  }, [reducedMotion]);

  const feed = useMemo(
    () => announcements.filter((item) => item.status === 'published' && isLive(item.startsAt, item.endsAt)),
    [announcements],
  );

  const { index, progressPercent, goTo, next, previous } = useRotation(feed.length, {
    intervalMs: ROTATION_MS,
    autoPlay: !paused,
  });

  const current = feed[index] ?? null;
  const critical = current ? PRIORITY_VIEW[current.priority] : null;

  // Atajos de teclado documentados en pantalla (2.1.4 / 2.1.1).
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(target.tagName)) return;
      if (event.code === 'Space' || event.key === ' ') {
        event.preventDefault();
        setPaused((value) => !value);
      } else if (event.key === 'ArrowRight') {
        next();
      } else if (event.key === 'ArrowLeft') {
        previous();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [next, previous]);

  return (
    <div className="on-dark display-surface flex min-h-screen flex-col">
      <header className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-white/20 px-6 py-3 text-sm">
        <p className="flex items-center gap-2 font-bold">
          <span aria-hidden="true">📺</span> Pantalla de emisión
        </p>
        <div className="flex items-center gap-4">
          <p role="status" aria-live="polite" className="flex items-center gap-2">
            <span aria-hidden="true">{socketStatus === 'online' ? '●' : '▲'}</span>
            {socketStatus === 'online'
              ? 'Conectada al servidor'
              : socketStatus === 'connecting'
                ? 'Conectando…'
                : 'Sin conexión: reintentando'}
          </p>
          <Clock />
        </div>
      </header>

      <main id="contenido" className="flex flex-1 flex-col justify-center px-6 py-8">
        {loading && feed.length === 0 && (
          <p role="status" className="text-center text-2xl">
            Cargando anuncios…
          </p>
        )}

        {!loading && feed.length === 0 && (
          <div className="mx-auto max-w-3xl text-white">
            {error && error.status === 401 ? (
              <EmptyStateDark
                title="Enlace de pantalla no válido"
                description="El token de esta pantalla fue revocado o no existe. Solicite un enlace nuevo al administrador del sistema."
              />
            ) : (
              <EmptyStateDark
                title="Sin anuncios por ahora"
                description="Esta pantalla está conectada. Los anuncios publicados aparecerán automáticamente."
              />
            )}
          </div>
        )}

        {current && critical && (
          <article
            key={current.id}
            aria-labelledby="display-title"
            className={`mx-auto w-full max-w-5xl ${
              critical.isUrgent ? 'display-announcement display-announcement--critical' : 'display-announcement'
            }`}
          >
            <div className="flex flex-wrap items-center gap-4">
              <PriorityBadge priority={current.priority} />
              <p className="text-sm text-white/80">
                Anuncio {index + 1} de {feed.length}
                {lastSyncAt ? ` · sincronizado a las ${formatTime(lastSyncAt)}` : ''}
              </p>
            </div>

            <h1 id="display-title" className="mt-4 text-4xl font-extrabold leading-tight md:text-5xl">
              {current.title}
            </h1>
            <p className="mt-4 whitespace-pre-line text-2xl leading-relaxed md:text-3xl">{current.body}</p>

            <p className="mt-6 text-base text-white/80">
              {current.endsAt ? `Vigente hasta ${formatDateTime(current.endsAt)}` : 'Sin fecha de finalización'}
              {critical.isUrgent && ' · Anuncio de máxima urgencia'}
            </p>
          </article>
        )}

        {/* Región asertiva reservada a emergencias: sólo los anuncios críticos
            se anuncian de inmediato a los lectores de pantalla (4.1.3). */}
        <div
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
          className="sr-only"
        >
          {current && critical?.isUrgent
            ? `Anuncio crítico: ${current.title}. ${current.body}`
            : ''}
        </div>
      </main>

      <footer className="no-print border-t border-white/20 px-6 py-4">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4">
          <div className="rotation-meter w-full max-w-md" role="presentation">
            <div
              className={`rotation-meter__value ${critical?.isUrgent ? 'rotation-meter__value--critical' : ''}`}
              style={{ width: `${paused ? 0 : progressPercent}%` }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-white/90">
              {paused ? 'Rotación pausada' : 'Rotación automática cada 12 s'}
              {reducedMotion && ' (movimiento reducido)'}
            </p>

            <label htmlFor="announcement-jump" className="text-sm font-semibold">
              Ir al anuncio
            </label>
            <select
              id="announcement-jump"
              className="select max-w-xs"
              value={index}
              onChange={(event) => goTo(Number(event.target.value))}
            >
              {feed.map((item, position) => (
                <option key={item.id} value={position}>
                  {position + 1}. {item.title}
                </option>
              ))}
            </select>

            <button type="button" className="btn btn--secondary" onClick={previous}>
              ‹ Anterior
            </button>
            <button type="button" className="btn btn--primary" onClick={() => setPaused((value) => !value)}>
              {paused ? 'Reanudar rotación' : 'Pausar rotación'}
            </button>
            <button type="button" className="btn btn--secondary" onClick={next}>
              Siguiente ›
            </button>
          </div>

          <p className="text-xs text-white/70">
            Atajos: <kbd>Espacio</kbd> pausa o reanuda · <kbd>←</kbd> / <kbd>→</kbd> cambian de anuncio.
          </p>
        </div>
      </footer>
    </div>
  );
}

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return (
    <p className="font-mono text-base">
      <time dateTime={now.toISOString()}>{formatTime(now)}</time>
    </p>
  );
}

function EmptyStateDark({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-white/40 p-10 text-center">
      <p className="text-3xl font-bold">{title}</p>
      <p className="mt-3 text-xl text-white/90">{description}</p>
      <p className="mt-6 text-base">
        <Link className="underline" to="/">
          Volver a la portada del sistema
        </Link>
      </p>
    </div>
  );
}
