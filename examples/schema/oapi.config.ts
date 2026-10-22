import { defineConfig } from '@opentyped/oapi-compiler';

export default defineConfig({
  tsconfig: 'tsconfig.json',
  namespaces: { './accounts/**/*.ts': 'accounts', './billing/**/*.ts': 'billing' },
  openapi: '3.2.0',
  info: { title: 'Schemas', version: '1.0.0' },
  output: { document: 'openapi.json', declarations: 'openapi.d.ts' },
});
