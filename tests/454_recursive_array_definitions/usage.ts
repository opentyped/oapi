import type { components } from './schema.js';
type Category = components['schemas']['Category'];
const root: Category = { name: 'root', children: [{ name: 'leaf', children: [] }] };
// @ts-expect-error Recursive arrays keep their element contracts.
const wrong: Category = { name: 'root', children: [{ name: 1, children: [] }] };
void [root, wrong];
