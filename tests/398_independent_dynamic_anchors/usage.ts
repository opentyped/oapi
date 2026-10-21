import type { components } from './schema.js';

type Models = components['schemas'];
export const pair: Models['Pair'] = {
  accounts: { name: 'Ada', children: [{ name: 'Grace' }] },
  billing: { balance: 10, children: [{ balance: 20 }] },
};
// @ts-expect-error Repeated anchor names must not mix independent recursive resources.
export const wrong: Models['accounts.Tree'] = { name: 'Ada', children: [{ balance: 20 }] };
