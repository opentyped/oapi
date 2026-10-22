import { defineConfig } from '@opentyped/compiler';

export default defineConfig({
  tsconfig: 'tsconfig.json',
  namespaces: { './*.ts': 'api' },
  info: { title: 'Web example', version: '1.0.0' },
  output: { document: 'openapi.json', declarations: 'openapi.d.ts' },
});
