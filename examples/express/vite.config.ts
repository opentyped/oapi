import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { openapi } from '@opentyped/vite';
import generation from './oapi.config';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [openapi(generation)],
  build: { ssr: 'server.ts', outDir: 'dist', emitAssets: true },
});
