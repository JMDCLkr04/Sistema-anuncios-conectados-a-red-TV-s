import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useAnnouncement, useAnnouncementMutations } from '../../controllers/useAnnouncements';
import { useScreens } from '../../controllers/useScreens';
import type { AnnouncementInput, AnnouncementStatus, Priority } from '../../models/domain';
import { PRIORITY_VIEW, STATUS_VIEW, fromDateTimeLocal, toDateTimeLocal } from '../../models';
import { Field } from '../shared/Field';
import { ErrorState, LoadingState } from '../shared/StatusMessage';

/**
 * VISTA: formulario de anuncio (crear y editar).
 *
 * Accesibilidad (WCAG 2.2):
 *  - Etiquetas visibles y obligatorias marcadas en la etiqueta (3.3.2).
 *  - Validación al enviar con mensajes de texto junto al campo, `aria-invalid`
 *    y `aria-describedby` (3.3.1, 3.3.3).
 *  - `fieldset`/`legend` para agrupar los destinos (1.3.1).
 *  - El resumen de errores se anuncia con `role="alert"` (4.1.3).
 */
export function AnnouncementFormView({ mode }: { mode: 'create' | 'edit' }) {
  const { id = null } = useParams<{ id: string }>();
  const isEdit = mode === 'edit' && id !== null;

  const navigate = useNavigate();
  const { announcement, loading: loadingAnnouncement, error: loadError } = useAnnouncement(isEdit ? id : null);
  const { screens, loading: loadingScreens } = useScreens(0);
  const mutations = useAnnouncementMutations();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<Priority>('normal');
  const [status, setStatus] = useState<AnnouncementStatus>('published');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [allScreens, setAllScreens] = useState(true);
  const [screenIds, setScreenIds] = useState<string[]>([]);
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  // Carga los valores existentes al editar.
  useEffect(() => {
    if (!announcement) return;
    setTitle(announcement.title);
    setBody(announcement.body);
    setPriority(announcement.priority);
    setStatus(announcement.status);
    setStartsAt(toDateTimeLocal(announcement.startsAt));
    setEndsAt(toDateTimeLocal(announcement.endsAt));
    setAllScreens(announcement.allScreens);
    setScreenIds(announcement.screenIds);
  }, [announcement]);

  const serverErrors = useMemo(() => mutations.error?.fields ?? {}, [mutations.error]);
  const errors = useMemo(() => ({ ...serverErrors, ...localErrors }), [serverErrors, localErrors]);

  function validate(): boolean {
    const found: Record<string, string> = {};
    if (title.trim().length < 3) found.title = 'Escriba un título de al menos 3 caracteres.';
    if (body.trim().length < 3) found.body = 'Escriba el contenido del anuncio.';
    if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
      found.endsAt = 'La fecha de fin debe ser posterior al inicio.';
    }
    if (!allScreens && screenIds.length === 0) {
      found.screenIds = 'Seleccione al menos una pantalla o marque “Todas las pantallas”.';
    }
    setLocalErrors(found);
    return Object.keys(found).length === 0;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    if (!validate()) return;

    const input: AnnouncementInput = {
      title: title.trim(),
      body: body.trim(),
      priority,
      status,
      startsAt: fromDateTimeLocal(startsAt),
      endsAt: fromDateTimeLocal(endsAt),
      screenIds: allScreens ? [] : screenIds,
      allScreens,
    };

    if (isEdit && id) {
      const result = await mutations.update(id, input);
      if (result) setSaved(true);
      return;
    }

    const created = await mutations.create(input);
    if (created) navigate('/admin/anuncios');
  }

  if (isEdit && loadingAnnouncement) return <LoadingState label="Cargando el anuncio…" />;

  if (isEdit && loadError) {
    return (
      <ErrorState
        title="No se pudo abrir el anuncio"
        message={loadError.message}
        onRetry={() => navigate('/admin/anuncios')}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-extrabold text-brand-900">
          {isEdit ? 'Editar anuncio' : 'Nuevo anuncio'}
        </h1>
        <p className="mt-1 text-slate-700">
          {isEdit
            ? 'Los cambios se envían a las pantallas en cuanto guarda.'
            : 'El anuncio se difundirá por WebSocket a las pantallas de la red local.'}
        </p>
      </header>

      {mutations.error && Object.keys(serverErrors).length === 0 && (
        <div role="alert" className="rounded-lg border-2 border-urgent-200 bg-urgent-50 p-3 font-semibold text-urgent-900">
          {mutations.error.message}
        </div>
      )}

      {Object.keys(errors).length > 0 && (
        <div role="alert" className="rounded-lg border-2 border-urgent-200 bg-urgent-50 p-3 text-urgent-900">
          <p className="font-bold">Revise los siguientes campos:</p>
          <ul className="mt-1 list-disc pl-6">
            {Object.entries(errors).map(([field, message]) => (
              <li key={field}>
                <a href={`#${field}`} className="underline">
                  {message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {saved && (
        <p role="status" className="rounded-lg border-2 border-brand-300 bg-brand-50 p-3 font-semibold text-brand-900">
          Cambios guardados. Las pantallas ya muestran la versión actualizada.
        </p>
      )}

      <form className="flex flex-col gap-6" onSubmit={handleSubmit} noValidate>
        <Field id="title" label="Título" required error={errors.title} hint="Se muestra en grande en la pantalla.">
          {(a11y) => (
            <input
              {...a11y}
              className="input"
              name="title"
              type="text"
              value={title}
              maxLength={160}
              onChange={(event) => {
                setTitle(event.target.value);
                setLocalErrors((current) => ({ ...current, title: '' }));
              }}
            />
          )}
        </Field>

        <Field
          id="body"
          label="Contenido"
          required
          error={errors.body}
          hint="Texto completo del anuncio. Puede usar saltos de línea."
        >
          {(a11y) => (
            <textarea
              {...a11y}
              className="textarea"
              name="body"
              value={body}
              maxLength={4000}
              onChange={(event) => {
                setBody(event.target.value);
                setLocalErrors((current) => ({ ...current, body: '' }));
              }}
            />
          )}
        </Field>

        <div className="grid gap-6 md:grid-cols-2">
          <Field
            id="priority"
            label="Urgencia"
            required
            error={errors.priority}
            hint="“Crítico” se resalta en rojo y se anuncia de inmediato."
          >
            {(a11y) => (
              <select
                {...a11y}
                className="select"
                name="priority"
                value={priority}
                onChange={(event) => setPriority(event.target.value as Priority)}
              >
                {(Object.keys(PRIORITY_VIEW) as Priority[]).map((key) => (
                  <option key={key} value={key}>
                    {PRIORITY_VIEW[key].label} — {PRIORITY_VIEW[key].description}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field id="status" label="Estado" required error={errors.status}>
            {(a11y) => (
              <select
                {...a11y}
                className="select"
                name="status"
                value={status}
                onChange={(event) => setStatus(event.target.value as AnnouncementStatus)}
              >
                {(Object.keys(STATUS_VIEW) as AnnouncementStatus[]).map((key) => (
                  <option key={key} value={key}>
                    {STATUS_VIEW[key].label}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field
            id="startsAt"
            label="Inicio de vigencia"
            error={errors.startsAt}
            hint="Opcional: si se deja vacío, el anuncio se muestra de inmediato."
          >
            {(a11y) => (
              <input
                {...a11y}
                className="input"
                name="startsAt"
                type="datetime-local"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
              />
            )}
          </Field>

          <Field
            id="endsAt"
            label="Fin de vigencia"
            error={errors.endsAt}
            hint="Al cumplirse la fecha, el anuncio se retira automáticamente."
          >
            {(a11y) => (
              <input
                {...a11y}
                className="input"
                name="endsAt"
                type="datetime-local"
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
              />
            )}
          </Field>
        </div>

        <fieldset className="rounded-xl border-2 border-brand-200 p-4">
          <legend className="px-2 font-bold text-brand-900">Pantallas de destino</legend>

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-3">
              <input
                type="radio"
                name="target"
                value="all"
                checked={allScreens}
                onChange={() => setAllScreens(true)}
                className="h-5 w-5"
              />
              <span>Todas las pantallas registradas</span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="radio"
                name="target"
                value="specific"
                checked={!allScreens}
                onChange={() => setAllScreens(false)}
                className="h-5 w-5"
              />
              <span>Pantallas específicas</span>
            </label>
          </div>

          {!allScreens && (
            <div className="mt-4">
              {loadingScreens && <LoadingState label="Cargando pantallas…" />}
              {!loadingScreens && screens.length === 0 && (
                <p className="text-slate-700">
                  Aún no hay pantallas registradas.{' '}
                  <Link to="/admin/pantallas" className="underline">
                    Registre la primera
                  </Link>
                  .
                </p>
              )}
              {!loadingScreens && screens.length > 0 && (
                <ul className="grid gap-2 md:grid-cols-2">
                  {screens.map((screen) => (
                    <li key={screen.id}>
                      <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-2">
                        <input
                          type="checkbox"
                          className="mt-1 h-5 w-5"
                          checked={screenIds.includes(screen.id)}
                          onChange={(event) => {
                            setScreenIds((current) =>
                              event.target.checked
                                ? [...current, screen.id]
                                : current.filter((value) => value !== screen.id),
                            );
                            setLocalErrors((current) => ({ ...current, screenIds: '' }));
                          }}
                        />
                        <span>
                          <span className="font-semibold text-slate-900">{screen.name}</span>
                          <br />
                          <span className="text-sm text-slate-600">{screen.location}</span>
                          {!screen.active && (
                            <span className="ml-2 text-sm font-bold text-urgent-800">(inactiva)</span>
                          )}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              {errors.screenIds && (
                <p id="screenIds-error" className="mt-2 text-sm font-semibold text-urgent-800" role="alert">
                  {errors.screenIds}
                </p>
              )}
            </div>
          )}
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn btn--primary" disabled={mutations.saving}>
            {mutations.saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear anuncio'}
          </button>
          <Link to="/admin/anuncios" className="btn btn--secondary">
            Cancelar
          </Link>
          <button type="button" className="btn btn--ghost" onClick={() => mutations.resetError()}>
            Limpiar mensajes
          </button>
        </div>
      </form>
    </div>
  );
}
