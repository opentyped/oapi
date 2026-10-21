import type { components } from './schema.js';
type Node = components['schemas']['Node'];
type Leaf = components['schemas']['Leaf'];
const node: Node = { value: 'v', peer: { tag: 't' } };
const leaf: Leaf = { tag: 't' };
// @ts-expect-error Cross-document references keep the target's contracts.
const wrong: Node = { value: 'v', peer: { tag: 1 } };
void [node, leaf, wrong];
