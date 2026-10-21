import { defineConfig } from '@typedapi/compiler';
import { defaultParsers } from '@typedapi/vite';
import { ExpressParser } from '@typedapi/express/parser';

export default defineConfig({
  tsconfig: 'tsconfig.json',
  namespaces: { './models/**/*.ts': 'models', './api/**/*.ts': 'api' },
  info: { title: 'Users API', version: '1.0.0' },
  parsers: [...defaultParsers(), new ExpressParser()],
  outDir: 'generated',
});
