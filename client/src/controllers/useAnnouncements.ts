import { useCallback } from 'react';

import type { Announcement, AnnouncementInput } from '../models/domain';
import { announcementApi } from '../services/api';
import type { ApiError } from '../services/http';
import { useAsyncResource, useMutation } from './useAsyncResource';

/**
 * CONTROLADOR de escritura de anuncios (crear, actualizar, eliminar).
 *
 * La lectura del listado la realiza `useAnnouncementFeed`, que combina la
 * carga HTTP inicial con el flujo WebSocket. Así una única fuente de verdad
 * alimenta la tabla de administración y las pantallas.
 */
export interface AnnouncementMutations {
  create: (input: AnnouncementInput) => Promise<Announcement | null>;
  update: (id: string, input: Partial<AnnouncementInput>) => Promise<Announcement | null>;
  remove: (id: string) => Promise<boolean>;
  saving: boolean;
  error: ApiError | null;
  resetError: () => void;
}

export function useAnnouncementMutations(): AnnouncementMutations {
  const createMutation = useMutation((input: AnnouncementInput) => announcementApi.create(input));
  const updateMutation = useMutation(
    (payload: { id: string; input: Partial<AnnouncementInput> }) =>
      announcementApi.update(payload.id, payload.input),
  );
  const removeMutation = useMutation((id: string) => announcementApi.remove(id));

  const create = useCallback(
    async (input: AnnouncementInput) => {
      const result = await createMutation.run(input);
      return result?.announcement ?? null;
    },
    [createMutation],
  );

  const update = useCallback(
    async (id: string, input: Partial<AnnouncementInput>) => {
      const result = await updateMutation.run({ id, input });
      return result?.announcement ?? null;
    },
    [updateMutation],
  );

  const remove = useCallback(
    async (id: string) => {
      const result = await removeMutation.run(id);
      return result !== null;
    },
    [removeMutation],
  );

  const resetError = useCallback(() => {
    createMutation.reset();
    updateMutation.reset();
    removeMutation.reset();
  }, [createMutation, updateMutation, removeMutation]);

  return {
    create,
    update,
    remove,
    saving: createMutation.running || updateMutation.running || removeMutation.running,
    error: createMutation.error ?? updateMutation.error ?? removeMutation.error,
    resetError,
  };
}

/** CONTROLADOR del formulario de un anuncio existente. */
export function useAnnouncement(id: string | null): {
  announcement: Announcement | null;
  loading: boolean;
  error: ApiError | null;
} {
  const resource = useAsyncResource(async () => (id ? await announcementApi.get(id) : null), [id]);
  return {
    announcement: resource.data?.announcement ?? null,
    loading: id !== null && resource.status === 'loading',
    error: resource.error,
  };
}
