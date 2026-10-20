import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAnnouncementFeed } from '../../controllers/useAnnouncementFeed';
import { useAnnouncementMutations } from '../../controllers/useAnnouncements';
import type { AnnouncementStatus, Priority } from '../../models/domain';
import { PRIORITY_VIEW, STATUS_VIEW, compareByUrgency, formatDateTime, formatWindow } from '../../models';
import { ConfirmAction } from '../shared/ConfirmAction';
import { ConnectionIndicator } from '../shared/ConnectionIndicator';
import { EmptyState, ErrorState, LoadingState } from '../shared/StatusMessage';

/**
 * VISTA: listado y gestión de anuncios (rol Administrador).
 *
 * Los datos provienen del feed en tiempo real (HTTP inicial + WebSocket), por
 * lo que la tabla se actualiza sola cuando otro administrador publica algo.
 * Los filtros se aplican en el cliente sobre un máximo acotado de anuncios.
 */
export function AnnouncementsView() {
  const { announcements, loading, error, socketStatus, refresh } = useAnnouncementFeed({ mode: 'admin' });
  const mutations = useAnnouncementMutations();

  const [status, setStatus] = useState<AnnouncementStatus | ''>('');
  const [priority, setPriority] = useState<Priority | ''>('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return announcements
      .filter((item) => (status ? item.status === status : true))
      .filter((item) => (priority ? item.priority === priority : true))
      .filter((item) =>
        needle.length === 0
          ? true
          : item.title.toLowerCase().includes(needle) || item.body.toLowerCase().includes(needle),
      )
      .sort(compareByUrgency);
  }, [announcements, status, priority, search]);

  const selected = useMemo(
    () => visible.find((item) => item.id === selectedId) ?? null,
    [visible, selectedId],
  );

  async function handleDelete(id: string) {
    const ok = await mutations.remove(id);
    if (ok && selectedId === id) setSelectedId(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-brand-900">Anuncios</h1>
          <p className="mt-1 text-slate-700">
            Cree, programe y retire el contenido que ven las pantallas de la red local.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ConnectionIndicator status={socketStatus} />
          <Link to="/admin/anuncios/nuevo" className="btn btn--primary">
            Nuevo anuncio
          </Link>
        </div>
      </header>

      <form
        className="grid gap-4 rounded-xl border border-brand-200 bg-brand-50 p-4 md:grid-cols-4"
        onSubmit={(event) => event.preventDefault()}
        aria-label="Filtros del listado de anuncios"
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="filter-status" className="font-semibold text-brand-900">
            Estado
          </label>
          <select
            id="filter-status"
            className="select"
            value={status}
            onChange={(event) => setStatus(event.target.value as AnnouncementStatus | '')}
          >
            <option value="">Todos</option>
            <option value="draft">Borrador</option>
            <option value="published">Publicado</option>
            <option value="expired">Expirado</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="filter-priority" className="font-semibold text-brand-900">
            Urgencia
          </label>
          <select
            id="filter-priority"
            className="select"
            value={priority}
            onChange={(event) => setPriority(event.target.value as Priority | '')}
          >
            <option value="">Todas</option>
            {(Object.keys(PRIORITY_VIEW) as Priority[]).map((key) => (
              <option key={key} value={key}>
                {PRIORITY_VIEW[key].label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5 md:col-span-2">
          <label htmlFor="filter-search" className="font-semibold text-brand-900">
            Buscar por texto
          </label>
          <input
            id="filter-search"
            className="input"
            type="search"
            value={search}
            placeholder="Título o contenido del anuncio"
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="md:col-span-4">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => {
              setStatus('');
              setPriority('');
              setSearch('');
            }}
          >
            Limpiar filtros
          </button>
        </div>
      </form>

      {mutations.error && (
        <ErrorState title="La operación falló" message={mutations.error.message} />
      )}

      <p role="status" aria-live="polite" className="text-sm text-slate-600">
        {visible.length} de {announcements.length} anuncios coinciden con los filtros.
      </p>

      {loading && announcements.length === 0 && <LoadingState label="Cargando anuncios…" />}

      {error && !loading && (
        <ErrorState title="No se pudo cargar" message={error.message} onRetry={() => void refresh()} />
      )}

      {!loading && !error && visible.length === 0 && (
        <EmptyState
          title="Sin resultados"
          description="Ajuste los filtros o cree un anuncio nuevo."
          action={
            <Link to="/admin/anuncios/nuevo" className="btn btn--primary">
              Nuevo anuncio
            </Link>
          }
        />
      )}

      {visible.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-brand-200">
          <table className="data-table">
            <caption className="px-4 pt-4">
              Anuncios registrados. Use los botones de cada fila para editar o eliminar.
            </caption>
            <thead>
              <tr>
                <th scope="col">Título</th>
                <th scope="col">Urgencia</th>
                <th scope="col">Estado</th>
                <th scope="col">Vigencia</th>
                <th scope="col">Destino</th>
                <th scope="col">Actualizado</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <tr
                  key={item.id}
                  className={selectedId === item.id ? 'bg-brand-50' : undefined}
                  onFocus={() => setSelectedId(item.id)}
                >
                  <td className="max-w-md">
                    <span className="font-semibold text-slate-900">{item.title}</span>
                    <p className="mt-0.5 line-clamp-2 text-slate-600">{item.body}</p>
                  </td>
                  <td>{PRIORITY_VIEW[item.priority].label}</td>
                  <td>{STATUS_VIEW[item.status].label}</td>
                  <td>{formatWindow(item.startsAt, item.endsAt)}</td>
                  <td>{item.allScreens ? 'Todas las pantallas' : `${item.screenIds.length} pantalla(s)`}</td>
                  <td>{formatDateTime(item.updatedAt)}</td>
                  <td>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/admin/anuncios/${item.id}/editar`} className="btn btn--secondary">
                        Editar <span className="sr-only">“{item.title}”</span>
                      </Link>
                      <ConfirmAction
                        label="Eliminar"
                        confirmLabel="Eliminar"
                        subject={item.title}
                        busy={mutations.saving}
                        onConfirm={() => void handleDelete(item.id)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <p className="text-sm text-slate-600">
          Último anuncio enfocado: <strong>{selected.title}</strong>. Presione `Tab` para recorrer las
          acciones de su fila.
        </p>
      )}
    </div>
  );
}
