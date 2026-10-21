import type { components } from './schema.js';
type Order = components['schemas']['Order'];
const order: Order = {
  id: 'one',
  lines: [{ sku: 'a', quantity: 2 }],
  note: null,
  totals: { sub: 10, tags: ['gift'] },
};
// @ts-expect-error Nested arrays keep their element contracts.
const wrong: Order = { id: 'x', lines: [{ sku: 1 }], totals: { sub: 1, tags: [] } };
void [order, wrong];
