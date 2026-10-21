import type { components } from './schema.js';
type Tree = components['schemas']['Tree'];
const tree: Tree = { label: 'root', children: [{ label: 'leaf' }] };
// @ts-expect-error Dynamic recursion preserves the child schema.
const wrong: Tree = { label: 'root', children: [{ label: 123 }] };
void [tree, wrong];
