import { useEffect } from 'react';

/**
 * CONTROLADOR del título del documento.
 * Cada pantalla declara su título: mejora la orientación (WCAG 2.4.2) y el
 * historial del navegador.
 */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} · Sistema de anuncios`;
  }, [title]);
}
