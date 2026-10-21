import { defineConfig } from '@typedapi/compiler';

export default defineConfig({
  tsconfig: 'tsconfig.openapi.json',
  namespaces: { './*.ts': 'transport' },
  info: { title: 'Content example', version: '1.0.0' },
  outDir: 'generated',
});
