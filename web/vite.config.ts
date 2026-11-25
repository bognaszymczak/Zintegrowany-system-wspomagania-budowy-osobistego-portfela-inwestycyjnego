import { fileURLToPath, URL } from 'node:url';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  // Adres backendu (FastAPI) używany tylko w trybie developerskim.
  const apiTarget = env.VITE_DEV_API_TARGET || 'http://localhost:8000';

  return {
    plugins: [react()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5173,
      // Przeglądarka rozmawia zawsze z "/api" na własnym adresie;
      // Vite przekazuje te zapytania do backendu (brak problemów z CORS).
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
      },
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  };
});
