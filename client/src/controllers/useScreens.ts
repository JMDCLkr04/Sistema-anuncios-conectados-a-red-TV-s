import { useCallback, useEffect, useRef, useState } from 'react';

import type { Role, Screen, ScreenInput, ScreenWithToken, UserSummary } from '../models/domain';
import { screenApi, userApi } from '../services/api';
import type { ApiError } from '../services/http';
import { toApiError, useMutation } from './useAsyncResource';

/**
 * CONTROLADOR de pantallas.
 *
 * El listado se refresca por intervalo (telemetría de dispositivos: último
 * contacto y conexiones activas) y además destaca las pantallas en línea
 * informadas por el servidor. ISO 27001 A.8.16 (monitoreo de actividades).
 */
export interface UseScreensResult {
  screens: Screen[];
  connectedScreenIds: string[];
  loading: boolean;
  error: ApiError | null;
  reload: () => Promise<void>;
  create: (input: ScreenInput) => Promise<{ screen: ScreenWithToken; token: string; hint: string } | null>;
  update: (id: string, input: Partial<ScreenInput>) => Promise<Screen | null>;
  remove: (id: string) => Promise<boolean>;
  rotate: (id: string) => Promise<{ screen: ScreenWithToken; token: string; hint: string } | null>;
  saving: boolean;
  saveError: ApiError | null;
}

export function useScreens(pollIntervalMs = 20_000): UseScreensResult {
  const [screens, setScreens] = useState<Screen[]>([]);
  const [connectedScreenIds, setConnectedScreenIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    try {
      const response = await screenApi.list();
      if (!mountedRef.current) return;
      setScreens(response.screens);
      setConnectedScreenIds(response.connectedScreenIds);
      setError(null);
    } catch (caught) {
      if (mountedRef.current) setError(toApiError(caught));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    if (pollIntervalMs <= 0) return;
    const timer = setInterval(() => void reload(), pollIntervalMs);
    return () => clearInterval(timer);
  }, [reload, pollIntervalMs]);

  const createMutation = useMutation((input: ScreenInput) => screenApi.create(input));
  const updateMutation = useMutation(
    (payload: { id: string; input: Partial<ScreenInput> }) => screenApi.update(payload.id, payload.input),
  );
  const removeMutation = useMutation((id: string) => screenApi.remove(id));
  const rotateMutation = useMutation((id: string) => screenApi.rotateToken(id));

  const create = useCallback(
    async (input: ScreenInput) => {
      const result = await createMutation.run(input);
      if (!result) return null;
      await reload();
      return { screen: result.screen, token: result.screen.token, hint: result.connectionHint };
    },
    [createMutation, reload],
  );

  const update = useCallback(
    async (id: string, input: Partial<ScreenInput>) => {
      const result = await updateMutation.run({ id, input });
      if (!result) return null;
      await reload();
      return result.screen;
    },
    [updateMutation, reload],
  );

  const remove = useCallback(
    async (id: string) => {
      const result = await removeMutation.run(id);
      if (result === null) return false;
      await reload();
      return true;
    },
    [removeMutation, reload],
  );

  const rotate = useCallback(
    async (id: string) => {
      const result = await rotateMutation.run(id);
      if (!result) return null;
      await reload();
      return { screen: result.screen, token: result.screen.token, hint: result.connectionHint };
    },
    [rotateMutation, reload],
  );

  return {
    screens,
    connectedScreenIds,
    loading,
    error,
    reload,
    create,
    update,
    remove,
    rotate,
    saving:
      createMutation.running || updateMutation.running || removeMutation.running || rotateMutation.running,
    saveError: createMutation.error ?? updateMutation.error ?? removeMutation.error ?? rotateMutation.error,
  };
}

/** CONTROLADOR de cuentas (alta, rol, estado y contraseña). */
export function useUsers(): {
  users: UserSummary[];
  loading: boolean;
  error: ApiError | null;
  reload: () => Promise<void>;
  create: (input: { username: string; password: string; role: Role }) => Promise<UserSummary | null>;
  update: (id: string, input: { role?: Role; active?: boolean; password?: string }) => Promise<UserSummary | null>;
  remove: (id: string) => Promise<boolean>;
  saving: boolean;
  saveError: ApiError | null;
} {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const response = await userApi.list();
      setUsers(response.users);
      setError(null);
    } catch (caught) {
      setError(toApiError(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const createMutation = useMutation((input: { username: string; password: string; role: Role }) =>
    userApi.create(input),
  );
  const updateMutation = useMutation(
    (payload: { id: string; input: { role?: Role; active?: boolean; password?: string } }) =>
      userApi.update(payload.id, payload.input),
  );
  const removeMutation = useMutation((id: string) => userApi.remove(id));

  const create = useCallback(
    async (input: { username: string; password: string; role: Role }) => {
      const result = await createMutation.run(input);
      if (!result) return null;
      await reload();
      return result.user;
    },
    [createMutation, reload],
  );

  const update = useCallback(
    async (id: string, input: { role?: Role; active?: boolean; password?: string }) => {
      const result = await updateMutation.run({ id, input });
      if (!result) return null;
      await reload();
      return result.user;
    },
    [updateMutation, reload],
  );

  const remove = useCallback(
    async (id: string) => {
      const result = await removeMutation.run(id);
      if (result === null) return false;
      await reload();
      return true;
    },
    [removeMutation, reload],
  );

  return {
    users,
    loading,
    error,
    reload,
    create,
    update,
    remove,
    saving: createMutation.running || updateMutation.running || removeMutation.running,
    saveError: createMutation.error ?? updateMutation.error ?? removeMutation.error,
  };
}
