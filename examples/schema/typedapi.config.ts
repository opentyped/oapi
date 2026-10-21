import { defineConfig } from '@typedapi/compiler';

export default defineConfig({
  tsconfig: 'tsconfig.openapi.json',
  namespaces: { './accounts/**/*.ts': 'accounts', './billing/**/*.ts': 'billing' },
  openapi: '3.2.0',
  info: { title: 'Schemas', version: '1.0.0' },
  outDir: 'generated',
});
