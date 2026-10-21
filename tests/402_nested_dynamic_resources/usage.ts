import type { components } from './schema.js';

type Pair = components['schemas']['Pair'];
export const pair: Pair = {
  accounts: { name: 'Ada', children: [{ name: 'Grace' }] },
  billing: { balance: 12, children: [{ balance: 0 }] },
};
// @ts-expect-error Each recursive child retains its resource's fields.
export const invalidAccount: Pair['accounts'] = { name: 'Ada', children: [{ balance: 0 }] };
// @ts-expect-error A billing child cannot become an account model.
export const invalidBilling: Pair['billing'] = { balance: 0, children: [{ name: 'Ada' }] };
