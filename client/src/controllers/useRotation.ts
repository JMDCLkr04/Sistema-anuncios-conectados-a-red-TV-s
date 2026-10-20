import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * CONTROLADOR de rotación de la cartelera de pantalla.
 *
 * Accesibilidad (WCAG 2.2):
 *  - Criterio 2.2.2 (pausar, detener, ocultar): el contenido que avanza solo
 *    ofrece un botón de pausa visible y una navegación manual.
 *  - Criterio 2.3.3 (animación por interacción): si el sistema declara
 *    `prefers-reduced-motion: reduce`, la rotación arranca detenida.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);
    const listener = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, []);

  return reduced;
}

export interface UseRotationOptions {
  /** Tiempo en pantalla por anuncio (ms). */
  intervalMs?: number;
  /** Permite al usuario pausar la rotación. */
  autoPlay?: boolean;
}

export interface UseRotationResult {
  index: number;
  progressPercent: number;
  goTo: (next: number) => void;
  next: () => void;
  previous: () => void;
}

export function useRotation(total: number, options: UseRotationOptions = {}): UseRotationResult {
  const { intervalMs = 12_000, autoPlay = true } = options;
  const [index, setIndex] = useState(0);
  const [progressPercent, setProgressPercent] = useState(0);
  const elapsedRef = useRef(0);

  /** Reinicia el contador cuando cambia la cantidad de anuncios. */
  useEffect(() => {
    setIndex((current) => (total === 0 ? 0 : Math.min(current, total - 1)));
    elapsedRef.current = 0;
    setProgressPercent(0);
  }, [total]);

  const reset = useCallback(() => {
    elapsedRef.current = 0;
    setProgressPercent(0);
  }, []);

  useEffect(() => {
    if (!autoPlay || total <= 1) {
      elapsedRef.current = 0;
      setProgressPercent(0);
      return;
    }

    const tick = 100;
    const timer = setInterval(() => {
      elapsedRef.current += tick;
      if (elapsedRef.current >= intervalMs) {
        elapsedRef.current = 0;
        setIndex((current) => (current + 1) % total);
      }
      setProgressPercent(Math.min((elapsedRef.current / intervalMs) * 100, 100));
    }, tick);

    return () => clearInterval(timer);
  }, [autoPlay, intervalMs, total]);

  const goTo = useCallback(
    (next: number) => {
      if (total === 0) return;
      setIndex(((next % total) + total) % total);
      reset();
    },
    [total, reset],
  );

  return {
    index,
    progressPercent,
    goTo,
    next: () => goTo(index + 1),
    previous: () => goTo(index - 1),
  };
}
