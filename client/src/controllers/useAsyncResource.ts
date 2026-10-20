import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '../services/http';

/**
 * CONTROLADOR genérico de carga de datos (patrón `resource`).
 * Centraliza los estados de carga/éxito/error que después consumen las VISTAS,
 * de modo que ningún componente tenga que repetir esa lógica.
 */
export type AsyncStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface AsyncState<T> {
  status: AsyncStatus;
  data: T | null;
  error: ApiError | null;
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof DOMException && error.name === 'AbortError') {
    return new ApiError(0, 'ABORTED', 'La operación fue cancelada.');
  }
  return new ApiError(0, 'UNKNOWN_ERROR', 'Ocurrió un error inesperado en la interfaz.');
}

export interface UseAsyncResourceResult<T> extends AsyncState<T> {
  reload: () => Promise<void>;
  setData: (updater: (current: T | null) => T | null) => void;
}

/**
 * Carga un recurso y expone `reload` para refrescarlo.
 * `deps` vuelve a ejecutar la carga cuando cambia algún filtro.
 */
export function useAsyncResource<T>(
  loader: () => Promise<T>,
  deps: readonly unknown[] = [],
): UseAsyncResourceResult<T> {
  const [state, setState] = useState<AsyncState<T>>({ status: 'idle', data: null, error: null });
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    setState((current) => ({ ...current, status: 'loading', error: null }));
    try {
      const data = await loaderRef.current();
      if (!mountedRef.current) return;
      setState({ status: 'ready', data, error: null });
    } catch (error) {
      if (!mountedRef.current) return;
      setState({ status: 'error', data: null, error: toApiError(error) });
    }
  }, []);

  // Se reejecuta al cambiar cualquiera de las dependencias declaradas.
  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, ...deps]);

  const setData = useCallback((updater: (current: T | null) => T | null) => {
    setState((current) => ({ ...current, data: updater(current.data) }));
  }, []);

  return { ...state, reload, setData };
}

/**
 * Controlador de una mutación (crear/actualizar/eliminar) con estado propio.
 * Devuelve `null` si la operación falló, para que la vista decida el mensaje.
 */
export function useMutation<TInput, TResult>(
  action: (input: TInput) => Promise<TResult>,
): {
  run: (input: TInput) => Promise<TResult | null>;
  running: boolean;
  error: ApiError | null;
  reset: () => void;
} {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const actionRef = useRef(action);
  actionRef.current = action;
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(async (input: TInput): Promise<TResult | null> => {
    setRunning(true);
    setError(null);
    try {
      const result = await actionRef.current(input);
      return result;
    } catch (caught) {
      if (mountedRef.current) setError(toApiError(caught));
      return null;
    } finally {
      if (mountedRef.current) setRunning(false);
    }
  }, []);

  const reset = useCallback(() => setError(null), []);

  return { run, running, error, reset };
}
