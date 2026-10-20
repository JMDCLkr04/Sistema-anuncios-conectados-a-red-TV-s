import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../../controllers/useAuth';
import { ROLE_VIEW } from '../../models';
import { Field } from '../shared/Field';
import { FormError } from '../shared/ConnectionIndicator';
import { LoadingState } from '../shared/StatusMessage';

/**
 * VISTA: inicio de sesión.
 * Accesibilidad: etiquetas visibles, errores anunciados con `role="alert"`,
 * foco automático en el primer campo, y descripción de los roles disponibles.
 */
export function LoginView() {
  const { login, error, status, user, clearError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as { from?: string } | null)?.from;

  useEffect(() => {
    if (status === 'authenticated' && user) {
      navigate(from ?? (user.role === 'admin' ? '/admin' : '/vision'), { replace: true });
    }
  }, [status, user, from, navigate]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    await login(username.trim(), password);
    setSubmitting(false);
  }

  if (status === 'loading') return <LoadingState label="Verificando la sesión…" />;
  if (status === 'authenticated') return <LoadingState label="Sesión iniciada. Redirigiendo…" />;

  return (
    <div className="mx-auto grid max-w-4xl gap-8 py-6 md:grid-cols-2">
      <section aria-labelledby="login-title">
        <h1 id="login-title" className="text-3xl font-extrabold text-brand-900">
          Iniciar sesión
        </h1>
        <p className="mt-2 text-slate-700">
          Acceda con su cuenta institucional. La sesión se guarda en una cookie segura y caduca
          automáticamente.
        </p>

        <form className="mt-6 flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
          <FormError message={error ? error.message : null} />

          <Field id="username" label="Usuario" required>
            {(a11y) => (
              <input
                {...a11y}
                className="input"
                name="username"
                type="text"
                autoComplete="username"
                autoFocus
                value={username}
                maxLength={60}
                onChange={(event) => {
                  setUsername(event.target.value);
                  clearError();
                }}
              />
            )}
          </Field>

          <Field
            id="password"
            label="Contraseña"
            required
            hint="Mínimo 12 caracteres, con mayúscula, minúscula, número y símbolo."
          >
            {(a11y) => (
              <input
                {...a11y}
                className="input"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                maxLength={128}
                onChange={(event) => {
                  setPassword(event.target.value);
                  clearError();
                }}
              />
            )}
          </Field>

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? 'Verificando…' : 'Entrar'}
            </button>
            <Link to="/" className="btn btn--secondary">
              Volver al inicio
            </Link>
          </div>

          {submitting && <LoadingState label="Validando credenciales…" />}
        </form>
      </section>

      <section aria-labelledby="roles-title" className="rounded-xl border-2 border-brand-200 bg-brand-50 p-5">
        <h2 id="roles-title" className="text-xl font-bold text-brand-900">
          Roles del sistema
        </h2>
        <ul className="mt-3 space-y-3">
          {(Object.keys(ROLE_VIEW) as (keyof typeof ROLE_VIEW)[]).map((role) => (
            <li key={role}>
              <p className="font-bold text-brand-900">{ROLE_VIEW[role].label}</p>
              <p className="text-slate-700">{ROLE_VIEW[role].description}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-slate-700">
          Las cuentas de demostración se generan con <code className="font-mono">npm run seed</code> y se
          listan en el README del proyecto.
        </p>
      </section>
    </div>
  );
}
