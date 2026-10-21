import type { components } from './schema.js';
type Node = components['schemas']['Node'];
const node: Node = { label: 'a', next: { label: 'b' } };
// @ts-expect-error Recursive references keep the declared shape.
const wrong: Node = { label: 'a', next: { label: 1 } };
void [node, wrong];
