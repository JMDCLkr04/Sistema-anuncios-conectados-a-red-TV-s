import { useMemo } from 'react';

import { useAnnouncementFeed } from '../../controllers/useAnnouncementFeed';
import { useDocumentTitle } from '../../controllers/useDocumentTitle';
import { pluralize } from '../../models';
import { AnnouncementCard } from '../shared/AnnouncementCard';
import { ConnectionIndicator } from '../shared/ConnectionIndicator';
import { EmptyState, ErrorState, LoadingState } from '../shared/StatusMessage';

/**
 * VISTA: cartelera del rol "Observador" (sólo lectura).
 *
 * El contenido se suscribe por WebSocket, pero una región `aria-live="polite"`
 * resume los cambios sin interrumpir la lectura en curso (WCAG 4.1.3).
 */
export function ViewerView() {
  useDocumentTitle('Cartelera de anuncios');
  const { announcements, loading, error, socketStatus, lastSyncAt, refresh } = useAnnouncementFeed({
    mode: 'viewer',
  });

  const urgentCount = useMemo(
    () => announcements.filter((item) => item.priority === 'critical').length,
    [announcements],
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-brand-900">Cartelera de anuncios</h1>
          <p className="mt-1 text-slate-700">
            Consulta en modo lectura. {pluralize(announcements.length, 'anuncio vigente', 'anuncios vigentes')}
            {urgentCount > 0 && (
              <>
                , {pluralize(urgentCount, 'crítico', 'críticos')} que requieren atención inmediata
              </>
            )}
            .
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ConnectionIndicator status={socketStatus} />
          <button type="button" className="btn btn--secondary" onClick={() => void refresh()}>
            Actualizar ahora
          </button>
        </div>
      </header>

      <p role="status" aria-live="polite" className="text-sm text-slate-600">
        {lastSyncAt
          ? `Última sincronización: ${new Date(lastSyncAt).toLocaleTimeString('es-ES')}`
          : 'Estableciendo conexión con el servidor…'}
      </p>

      {error && !loading && (
        <ErrorState
          title="No se pudo cargar la cartelera"
          message={error.message}
          onRetry={() => void refresh()}
        />
      )}

      {loading && announcements.length === 0 && <LoadingState label="Cargando anuncios publicados…" />}

      {!loading && !error && announcements.length === 0 && (
        <EmptyState
          title="Sin anuncios publicados"
          description="Cuando un administrador publique un anuncio, aparecerá aquí automáticamente."
        />
      )}

      {announcements.length > 0 && (
        <section aria-label="Anuncios publicados" className="flex flex-col gap-4">
          {announcements.map((announcement) => (
            <AnnouncementCard key={announcement.id} announcement={announcement} />
          ))}
        </section>
      )}
    </div>
  );
}
