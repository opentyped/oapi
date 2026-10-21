import { defineConfig } from '@typedapi/compiler';

export default defineConfig({
  tsconfig: 'tsconfig.json',
  namespaces: { './*.ts': 'billing' },
  info: { title: 'Serialization example', version: '1.0.0' },
  outDir: 'generated',
  typeMappings: [
    {
      match: { module: 'decimal.js', export: 'default' },
      schema: { type: 'string', examples: ['19.95'] },
    },
  ],
});
