import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import type { Role, SessionUser } from '../models/domain';
import { authApi } from '../services/api';
import { ApiError } from '../services/http';
import { toApiError } from './useAsyncResource';

/**
 * CONTROLADOR de sesión. Mantiene quién es el usuario actual y expone las
 * operaciones de autenticación. La VISTA sólo lee este estado.
 *
 * Nota de seguridad: el token de sesión vive en una cookie httpOnly emitida por
 * el servidor; JavaScript nunca lo manipula (ISO 27001 A.8.28).
 */
export type AuthStatus = 'loading' | 'anonymous' | 'authenticated';

export interface AuthContextValue {
  status: AuthStatus;
  user: SessionUser | null;
  error: ApiError | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
  hasRole: (role: Role) => boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): ReactNode {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  // Hidratación inicial: si existe cookie válida, se recupera el perfil.
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await authApi.me();
        if (!active) return;
        setUser(response.user);
        setStatus('authenticated');
      } catch {
        if (!active) return;
        setUser(null);
        setStatus('anonymous');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    setError(null);
    try {
      const response = await authApi.login(username, password);
      setUser(response.user);
      setStatus('authenticated');
      return true;
    } catch (caught) {
      setError(toApiError(caught));
      setStatus('anonymous');
      return false;
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setStatus('anonymous');
      setError(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      error,
      login,
      logout,
      clearError: () => setError(null),
      hasRole: (role: Role) => user?.role === role,
      isAdmin: user?.role === 'admin',
    }),
    [status, user, error, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de <AuthProvider>.');
  return context;
}
