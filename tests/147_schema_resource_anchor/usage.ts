import type { components } from './schema.js';

const forest: components['schemas']['Forest'] = {
  entry: { label: 'root', children: [{ label: 'leaf' }] },
};
const tree: components['schemas']['Tree'] = {
  label: 'root',
  children: [{ label: 'leaf' }],
};
// @ts-expect-error Recursive resource nodes require string labels.
const invalid: components['schemas']['Forest'] = { entry: { label: 123 } };
// @ts-expect-error $defs is schema metadata, never a required or allowed payload property.
const metadata: components['schemas']['Forest'] = { entry: { label: 'root' }, $defs: {} };
void [forest, tree, invalid, metadata];
