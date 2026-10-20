import { useAuditLog } from '../../controllers/useAnnouncementFeed';
import { formatDateTime } from '../../models';
import { ErrorState, LoadingState } from '../shared/StatusMessage';

/**
 * VISTA: bitácora de auditoría (ISO 27001 A.8.15 / A.8.16).
 * Tabla con `caption` y encabezados `th scope="col"` para navegación accesible
 * (WCAG 1.3.1). Los resultados se muestran con texto, no sólo con color.
 */
export function AuditView() {
  const { entries, loading, error, reload } = useAuditLog(200);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-brand-900">Bitácora de auditoría</h1>
          <p className="mt-1 text-slate-700">
            Registro de sólo anexado de los eventos de seguridad y de los cambios de contenido.
          </p>
        </div>
        <button type="button" className="btn btn--secondary" onClick={() => void reload()}>
          Actualizar
        </button>
      </header>

      {loading && entries.length === 0 && <LoadingState label="Cargando la bitácora…" />}

      {error && (
        <ErrorState
          title="No se pudo leer la bitácora"
          message={error.message}
          onRetry={() => void reload()}
        />
      )}

      {entries.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-brand-200">
          <table className="data-table">
            <caption className="px-4 pt-4">
              Últimos {entries.length} eventos registrados por el servidor (más recientes primero).
            </caption>
            <thead>
              <tr>
                <th scope="col">Fecha y hora</th>
                <th scope="col">Usuario</th>
                <th scope="col">Acción</th>
                <th scope="col">Entidad</th>
                <th scope="col">Resultado</th>
                <th scope="col">Dirección IP</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatDateTime(entry.createdAt)}</td>
                  <td>{entry.username ?? '—'}</td>
                  <td className="font-mono text-xs">{entry.action}</td>
                  <td>{entry.entity ?? '—'}</td>
                  <td>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                        entry.outcome === 'success'
                          ? 'bg-brand-100 text-brand-900'
                          : 'bg-urgent-100 text-urgent-900'
                      }`}
                    >
                      {entry.outcome === 'success' ? 'Correcto' : 'Fallido'}
                    </span>
                  </td>
                  <td className="font-mono text-xs">{entry.ip ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && entries.length === 0 && (
        <p className="text-slate-700">La bitácora está vacía.</p>
      )}

      <p className="text-sm text-slate-600">
        Nota de seguridad: la aplicación no puede modificar ni eliminar eventos de esta bitácora; el rol de
        base de datos sólo tiene permiso de inserción y lectura (ISO 27001 A.5.33, A.8.15).
      </p>
    </div>
  );
}
