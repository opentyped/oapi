import { defineConfig } from '@opentyped/oapi-compiler';
import { defaultParsers } from '@opentyped/oapi-vite';
import { ExpressParser } from '@opentyped/oapi-express/parser';

export default defineConfig({
  tsconfig: 'tsconfig.json',
  namespaces: { './models/**/*.ts': 'models', './api/**/*.ts': 'api' },
  info: { title: 'Users API', version: '1.0.0' },
  parsers: [...defaultParsers(), new ExpressParser()],
  output: { document: 'openapi.json', declarations: 'openapi.d.ts' },
});
