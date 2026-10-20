import { useState } from 'react';

import { useAuth } from '../../controllers/useAuth';
import { useUsers } from '../../controllers/useScreens';
import { ROLE_VIEW, formatDateTime } from '../../models';
import type { Role } from '../../models/domain';
import { ConfirmAction } from '../shared/ConfirmAction';
import { Field } from '../shared/Field';
import { ErrorState, LoadingState } from '../shared/StatusMessage';

const EMPTY_FORM = { username: '', password: '', role: 'client' as Role };

/**
 * VISTA: gestión de cuentas (ISO 27001 A.5.16, A.5.18, A.8.2).
 *
 * - El rol se cambia con un `select` etiquetado por fila.
 * - La baja lógica (deshabilitar) es la opción recomendada; el borrado definitivo
 *   exige confirmación explícita.
 * - El servidor impide quedarse sin administradores activos.
 */
export function AccountsView() {
  const { user: session } = useAuth();
  const { users, loading, error, reload, create, update, remove, saving, saveError } = useUsers();

  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [passwordTarget, setPasswordTarget] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [notice, setNotice] = useState('');

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors: Record<string, string> = {};
    if (!/^[a-zA-Z0-9._-]{3,60}$/.test(form.username.trim())) {
      errors.username = 'Entre 3 y 60 caracteres: letras, números, punto, guion o guion bajo.';
    }
    if (form.password.length < 12) {
      errors.password = 'La contraseña debe tener al menos 12 caracteres.';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const created = await create({ username: form.username.trim(), password: form.password, role: form.role });
    if (created) {
      setForm(EMPTY_FORM);
      setNotice(`Cuenta “${created.username}” creada correctamente.`);
    }
  }

  async function handlePasswordChange(id: string) {
    if (newPassword.length < 12) {
      setFieldErrors({ newPassword: 'La contraseña debe tener al menos 12 caracteres.' });
      return;
    }
    const updated = await update(id, { password: newPassword });
    if (updated) {
      setNotice(`Contraseña actualizada para “${updated.username}”.`);
      setPasswordTarget(null);
      setNewPassword('');
      setFieldErrors({});
    }
  }

  const serverErrors = saveError?.fields ?? {};

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-extrabold text-brand-900">Cuentas</h1>
        <p className="mt-1 text-slate-700">
          Administradores que publican anuncios y observadores que sólo consultan la cartelera.
        </p>
      </header>

      <p role="status" aria-live="polite" className="text-brand-900 font-semibold">
        {notice}
      </p>

      {saveError && Object.keys(serverErrors).length === 0 && (
        <ErrorState title="La operación falló" message={saveError.message} />
      )}

      <section aria-labelledby="new-account-title" className="rounded-xl border border-brand-200 p-4">
        <h2 id="new-account-title" className="text-xl font-bold text-brand-900">
          Crear cuenta
        </h2>
        <form className="mt-4 grid gap-4 md:grid-cols-3" onSubmit={handleCreate} noValidate>
          <Field id="new-username" label="Usuario" required error={fieldErrors.username ?? serverErrors.username}>
            {(a11y) => (
              <input
                {...a11y}
                className="input"
                type="text"
                autoComplete="off"
                value={form.username}
                maxLength={60}
                onChange={(event) => setForm({ ...form, username: event.target.value })}
              />
            )}
          </Field>

          <Field
            id="new-password"
            label="Contraseña"
            required
            error={fieldErrors.password ?? serverErrors.password}
            hint="Mínimo 12 caracteres, con mayúscula, minúscula, número y símbolo."
          >
            {(a11y) => (
              <input
                {...a11y}
                className="input"
                type="password"
                autoComplete="new-password"
                value={form.password}
                maxLength={128}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
              />
            )}
          </Field>

          <Field id="new-role" label="Rol" required>
            {(a11y) => (
              <select
                {...a11y}
                className="select"
                value={form.role}
                onChange={(event) => setForm({ ...form, role: event.target.value as Role })}
              >
                {(Object.keys(ROLE_VIEW) as Role[]).map((role) => (
                  <option key={role} value={role}>
                    {ROLE_VIEW[role].label} — {ROLE_VIEW[role].description}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <div className="md:col-span-3">
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Creando…' : 'Crear cuenta'}
            </button>
          </div>
        </form>
      </section>

      {loading && users.length === 0 && <LoadingState label="Cargando cuentas…" />}

      {error && !loading && (
        <ErrorState title="No se pudo cargar" message={error.message} onRetry={() => void reload()} />
      )}

      {users.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-brand-200">
          <table className="data-table">
            <caption className="px-4 pt-4">
              Cuentas registradas. El rol “Observador” no puede crear ni editar anuncios.
            </caption>
            <thead>
              <tr>
                <th scope="col">Usuario</th>
                <th scope="col">Rol</th>
                <th scope="col">Estado</th>
                <th scope="col">Último acceso</th>
                <th scope="col">Creada</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((account) => {
                const isSelf = account.id === session?.id;
                return (
                  <tr key={account.id}>
                    <td className="font-semibold text-slate-900">
                      {account.username}
                      {isSelf && <span className="ml-2 text-xs font-normal text-slate-600">(su cuenta)</span>}
                    </td>
                    <td>
                      <label className="sr-only" htmlFor={`role-${account.id}`}>
                        Rol de {account.username}
                      </label>
                      <select
                        id={`role-${account.id}`}
                        className="select"
                        value={account.role}
                        disabled={saving}
                        onChange={(event) =>
                          void update(account.id, { role: event.target.value as Role })
                        }
                      >
                        {(Object.keys(ROLE_VIEW) as Role[]).map((role) => (
                          <option key={role} value={role}>
                            {ROLE_VIEW[role].label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          account.active ? 'bg-brand-100 text-brand-900' : 'bg-slate-200 text-slate-800'
                        }`}
                      >
                        {account.active ? 'Activa' : 'Deshabilitada'}
                      </span>
                    </td>
                    <td>{formatDateTime(account.lastLoginAt)}</td>
                    <td>{formatDateTime(account.createdAt)}</td>
                    <td>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          className="btn btn--secondary"
                          disabled={saving}
                          onClick={() => void update(account.id, { active: !account.active })}
                        >
                          {account.active ? 'Deshabilitar' : 'Habilitar'}
                          <span className="sr-only"> la cuenta {account.username}</span>
                        </button>

                        <button
                          type="button"
                          className="btn btn--secondary"
                          onClick={() => {
                            setPasswordTarget(passwordTarget === account.id ? null : account.id);
                            setNewPassword('');
                          }}
                        >
                          Cambiar contraseña
                          <span className="sr-only"> de {account.username}</span>
                        </button>

                        <ConfirmAction
                          label="Eliminar"
                          confirmLabel="Eliminar"
                          subject={account.username}
                          description={
                            isSelf
                              ? 'Advertencia: está a punto de eliminar su propia cuenta. ¿Confirma la eliminación?'
                              : undefined
                          }
                          busy={saving}
                          onConfirm={() => void remove(account.id)}
                        />
                      </div>

                      {passwordTarget === account.id && (
                        <div className="mt-3 flex flex-wrap items-end gap-3 rounded-lg border border-brand-200 bg-brand-50 p-3">
                          <Field
                            id={`password-${account.id}`}
                            label="Nueva contraseña"
                            required
                            error={fieldErrors.newPassword}
                            hint="Mínimo 12 caracteres con mayúscula, minúscula, número y símbolo."
                          >
                            {(a11y) => (
                              <input
                                {...a11y}
                                className="input"
                                type="password"
                                autoComplete="new-password"
                                value={newPassword}
                                maxLength={128}
                                onChange={(event) => setNewPassword(event.target.value)}
                              />
                            )}
                          </Field>
                          <button
                            type="button"
                            className="btn btn--primary"
                            disabled={saving}
                            onClick={() => void handlePasswordChange(account.id)}
                          >
                            Guardar contraseña
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-sm text-slate-600">
        Recomendación operativa (ISO 27001 A.5.18): revise los accesos cada trimestre y deshabilite las
        cuentas que ya no se usan en lugar de eliminarlas, para conservar la trazabilidad de la bitácora.
      </p>
    </div>
  );
}
