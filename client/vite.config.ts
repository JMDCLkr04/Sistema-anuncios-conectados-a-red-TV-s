import path from 'node:path';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Configuración del frontend (capa VISTA del MVC).
 *
 * - `host: true` publica el servidor de desarrollo en la red local (RFC 1918)
 *   para que las pantallas físicas puedan abrir la vista de emisión.
 * - El proxy mantiene el modelo de mismo origen: el navegador siempre ve
 *   `http://<ip-privada>:5173` y la cookie de sesión nunca sale del origen
 *   (refuerzo de SameSite=Strict y del control de CORS del backend).
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@domain': path.resolve(here, '../server/src/domain/index.ts'),
    },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: false,
    fs: {
      // Permite leer el contrato compartido del monolito (`server/src/domain`).
      allow: [path.resolve(here, '..')],
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: false,
      },
      '/ws': {
        target: 'ws://127.0.0.1:4000',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2022',
  },
});
