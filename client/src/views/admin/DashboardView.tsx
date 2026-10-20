import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../controllers/useAuth';
import { useAnnouncementFeed } from '../../controllers/useAnnouncementFeed';
import { PRIORITY_VIEW, isLive } from '../../models';
import { systemApi } from '../../services/api';
import { ConnectionIndicator, DetailItem } from '../shared/ConnectionIndicator';
import { EmptyState, LoadingState } from '../shared/StatusMessage';

/**
 * VISTA: resumen del panel administrativo.
 * Muestra indicadores del contenido y de la red (pantallas conectadas) además
 * de la actividad reciente recibida por WebSocket
 * (ISO 27001 A.8.16 actividades de monitoreo).
 */
export function DashboardView() {
  const { user } = useAuth();
  const { announcements, activity, socketStatus, loading, error } = useAnnouncementFeed({
    mode: 'admin',
    withActivity: true,
  });
  const [connectedScreens, setConnectedScreens] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const stats = await systemApi.realtimeStats();
        if (active) setConnectedScreens(stats.realtime.byKind.screen);
      } catch {
        if (active) setConnectedScreens(null);
      }
    };
    void load();
    const timer = setInterval(() => void load(), 30_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const metrics = useMemo(() => {
    const published = announcements.filter((item) => item.status === 'published');
    return {
      total: announcements.length,
      published: published.length,
      live: published.filter((item) => isLive(item.startsAt, item.endsAt)).length,
      drafts: announcements.filter((item) => item.status === 'draft').length,
      critical: published.filter((item) => item.priority === 'critical').length,
      expired: announcements.filter((item) => item.status === 'expired').length,
    };
  }, [announcements]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-brand-900">
            Hola, {user?.username ?? 'administrador'}
          </h1>
          <p className="mt-1 text-slate-700">
            Panel de control de la emisión de anuncios en la red local.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ConnectionIndicator status={socketStatus} />
          <Link to="/admin/anuncios/nuevo" className="btn btn--primary">
            Crear anuncio
          </Link>
        </div>
      </header>

      {error && (
        <p role="alert" className="rounded-lg border-2 border-urgent-200 bg-urgent-50 p-3 text-urgent-900">
          No se pudo sincronizar con el servidor: {error.message}
        </p>
      )}

      {loading && announcements.length === 0 ? (
        <LoadingState label="Cargando indicadores…" />
      ) : (
        <section aria-labelledby="metrics-title">
          <h2 id="metrics-title" className="sr-only">
            Indicadores
          </h2>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard label="Anuncios en el sistema" value={String(metrics.total)} />
            <MetricCard label="Publicados y vigentes" value={String(metrics.live)} tone="brand" />
            <MetricCard label="Críticos activos" value={String(metrics.critical)} tone="urgent" />
            <MetricCard label="Borradores" value={String(metrics.drafts)} />
            <MetricCard label="Expirados" value={String(metrics.expired)} />
            <MetricCard
              label="Pantallas conectadas ahora"
              value={connectedScreens === null ? '—' : String(connectedScreens)}
            />
          </dl>
        </section>
      )}

      <section aria-labelledby="activity-title" className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div>
          <h2 id="activity-title" className="text-xl font-bold text-brand-900">
            Actividad reciente (en vivo)
          </h2>
          <div role="log" aria-live="polite" className="mt-3 rounded-xl border border-brand-200 p-4">
            {activity.length === 0 ? (
              <p className="text-slate-600">
                Aún no se recibieron eventos en esta sesión. Publique un anuncio para verlos aquí.
              </p>
            ) : (
              <ul className="space-y-2">
                {activity.map((event, index) => (
                  <li key={`${event.createdAt}-${index}`} className="text-sm text-slate-800">
                    <span className="font-mono text-slate-600">
                      {new Date(event.createdAt).toLocaleTimeString('es-ES')}
                    </span>{' '}
                    <strong>{event.username ?? 'sistema'}</strong> · {translateAction(event.action)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-brand-900">Prioridades del sistema</h2>
          <dl className="mt-3 space-y-2 rounded-xl border border-brand-200 p-4">
            {(Object.keys(PRIORITY_VIEW) as (keyof typeof PRIORITY_VIEW)[]).map((priority) => (
              <DetailItem key={priority} label={PRIORITY_VIEW[priority].label}>
                {PRIORITY_VIEW[priority].description}
              </DetailItem>
            ))}
          </dl>
        </div>
      </section>

      {metrics.published === 0 && (
        <EmptyState
          title="Todavía no hay anuncios publicados"
          description="Cree el primer anuncio y aparecerá en todas las pantallas conectadas de la red local."
          action={
            <Link to="/admin/anuncios/nuevo" className="btn btn--primary">
              Crear el primer anuncio
            </Link>
          }
        />
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'brand' | 'urgent';
}) {
  const toneClass =
    tone === 'urgent'
      ? 'border-urgent-200 bg-urgent-50 text-urgent-900'
      : tone === 'brand'
        ? 'border-brand-300 bg-brand-50 text-brand-900'
        : 'border-slate-200 bg-white text-slate-900';
  return (
    <div className={`rounded-xl border-2 p-4 ${toneClass}`}>
      <dt className="text-sm font-semibold uppercase tracking-wide">{label}</dt>
      <dd className="mt-1 text-3xl font-extrabold">{value}</dd>
    </div>
  );
}

function translateAction(action: string): string {
  const dictionary: Record<string, string> = {
    'auth.login': 'inició sesión',
    'auth.logout': 'cerró sesión',
    'announcement.create': 'creó un anuncio',
    'announcement.update': 'actualizó un anuncio',
    'announcement.delete': 'eliminó un anuncio',
    'screen.create': 'registró una pantalla',
    'screen.update': 'actualizó una pantalla',
    'screen.delete': 'eliminó una pantalla',
    'screen.rotate_token': 'rotó el token de una pantalla',
    'user.create': 'creó una cuenta',
    'user.update': 'actualizó una cuenta',
    'user.delete': 'eliminó una cuenta',
  };
  return dictionary[action] ?? action;
}
