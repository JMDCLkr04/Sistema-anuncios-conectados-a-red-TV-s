import { useState } from 'react';

import { useScreens } from '../../controllers/useScreens';
import { formatDateTime } from '../../models';
import type { ScreenWithToken } from '../../models/domain';
import { ConfirmAction } from '../shared/ConfirmAction';
import { Field } from '../shared/Field';
import { ErrorState, LoadingState } from '../shared/StatusMessage';

/**
 * VISTA: gestión de pantallas (dispositivos de la red local).
 *
 * El token de conexión se muestra UNA sola vez: en la base de datos sólo queda
 * su huella SHA-256 (ISO 27001 A.8.24 y A.8.5). Si se pierde, el administrador
 * debe rotarlo, lo que invalida el anterior de inmediato.
 */
export function ScreensView() {
  const { screens, connectedScreenIds, loading, error, reload, create, update, remove, rotate, saving, saveError } =
    useScreens();

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [issued, setIssued] = useState<{ screen: ScreenWithToken; hint: string } | null>(null);
  const [copyStatus, setCopyStatus] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (name.trim().length < 2) {
      setFormError('Escriba un nombre de al menos 2 caracteres para identificar la pantalla.');
      return;
    }
    const created = await create({ name: name.trim(), location: location.trim(), active: true });
    if (created) {
      setIssued({ screen: created.screen, hint: created.hint });
      setName('');
      setLocation('');
    }
  }

  async function handleRotate(id: string) {
    const rotated = await rotate(id);
    if (rotated) setIssued({ screen: rotated.screen, hint: rotated.hint });
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus('Enlace copiado al portapapeles.');
    } catch {
      setCopyStatus('No fue posible copiar automáticamente. Seleccione el texto y cópielo con Ctrl+C.');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-extrabold text-brand-900">Pantallas</h1>
        <p className="mt-1 text-slate-700">
          Cada pantalla de la red local se identifica con un token propio. El token se muestra una única vez.
        </p>
      </header>

      {saveError && <ErrorState title="La operación falló" message={saveError.message} />}

      {issued && (
        <section
          aria-labelledby="issued-title"
          className="rounded-xl border-2 border-brand-700 bg-brand-50 p-4"
        >
          <h2 id="issued-title" className="text-lg font-bold text-brand-900">
            Token de “{issued.screen.name}” (guárdelo ahora)
          </h2>
          <p className="mt-1 text-slate-800">
            Abra este enlace en el dispositivo que funcionará como pantalla. Por seguridad no se volverá a
            mostrar; si lo pierde, use “Rotar token”.
          </p>
          <p className="mt-3 break-all rounded-lg border border-brand-300 bg-white p-3 font-mono text-sm">
            {issued.hint}
          </p>
          <p className="mt-2 break-all rounded-lg border border-brand-300 bg-white p-3 font-mono text-xs">
            Token: {issued.screen.token}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => void copyToClipboard(issued.hint)}
            >
              Copiar enlace
            </button>
            <button type="button" className="btn btn--secondary" onClick={() => setIssued(null)}>
              Ocultar
            </button>
          </div>
          <p role="status" aria-live="polite" className="mt-2 text-sm text-slate-700">
            {copyStatus}
          </p>
        </section>
      )}

      <section aria-labelledby="new-screen-title" className="rounded-xl border border-brand-200 p-4">
        <h2 id="new-screen-title" className="text-xl font-bold text-brand-900">
          Registrar una pantalla
        </h2>
        <form className="mt-4 grid gap-4 md:grid-cols-3" onSubmit={handleCreate} noValidate>
          <Field id="screen-name" label="Nombre" required error={formError}>
            {(a11y) => (
              <input
                {...a11y}
                className="input"
                type="text"
                value={name}
                maxLength={80}
                placeholder="Recepción"
                onChange={(event) => setName(event.target.value)}
              />
            )}
          </Field>

          <Field id="screen-location" label="Ubicación" hint="Dónde está instalada físicamente.">
            {(a11y) => (
              <input
                {...a11y}
                className="input"
                type="text"
                value={location}
                maxLength={120}
                placeholder="Planta baja — acceso principal"
                onChange={(event) => setLocation(event.target.value)}
              />
            )}
          </Field>

          <div className="flex items-end">
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Registrando…' : 'Registrar pantalla'}
            </button>
          </div>
        </form>
        <p className="mt-2 text-sm text-slate-600">
          Nota: por seguridad, el registro sólo se acepta desde direcciones de la red local (RFC 1918).
        </p>
      </section>

      {loading && screens.length === 0 && <LoadingState label="Cargando pantallas…" />}

      {error && !loading && (
        <ErrorState title="No se pudo cargar" message={error.message} onRetry={() => void reload()} />
      )}

      {screens.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-brand-200">
          <table className="data-table">
            <caption className="px-4 pt-4">
              Pantallas registradas. “En línea” indica que el dispositivo mantiene una conexión WebSocket activa.
            </caption>
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Ubicación</th>
                <th scope="col">Estado</th>
                <th scope="col">Conexión</th>
                <th scope="col">Último contacto</th>
                <th scope="col">Anuncios vigentes</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {screens.map((screen) => {
                const online = connectedScreenIds.includes(screen.id);
                return (
                  <tr key={screen.id}>
                    <td className="font-semibold text-slate-900">{screen.name}</td>
                    <td>{screen.location}</td>
                    <td>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          screen.active ? 'bg-brand-100 text-brand-900' : 'bg-slate-200 text-slate-800'
                        }`}
                      >
                        {screen.active ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          online ? 'bg-brand-700 text-white' : 'bg-slate-200 text-slate-800'
                        }`}
                      >
                        {online ? 'En línea' : 'Desconectada'}
                      </span>
                    </td>
                    <td>{formatDateTime(screen.lastSeenAt)}</td>
                    <td>{screen.publishedCount}</td>
                    <td>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          className="btn btn--secondary"
                          onClick={() => void update(screen.id, { active: !screen.active })}
                          disabled={saving}
                        >
                          {screen.active ? 'Desactivar' : 'Activar'}
                          <span className="sr-only"> la pantalla {screen.name}</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn--secondary"
                          onClick={() => void handleRotate(screen.id)}
                          disabled={saving}
                        >
                          Rotar token
                          <span className="sr-only"> de la pantalla {screen.name}</span>
                        </button>
                        <ConfirmAction
                          label="Eliminar"
                          confirmLabel="Eliminar"
                          subject={screen.name}
                          busy={saving}
                          onConfirm={() => void remove(screen.id)}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && screens.length === 0 && (
        <p className="text-slate-700">
          Aún no hay pantallas registradas. Registre la primera con el formulario de arriba.
        </p>
      )}
    </div>
  );
}
