import { defineConfig } from '@typedapi/compiler';

export default defineConfig({
  tsconfig: 'tsconfig.json',
  namespaces: { './*.ts': 'api' },
  info: { title: 'Web example', version: '1.0.0' },
  outDir: 'generated',
});
