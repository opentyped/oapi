import type { components } from './schema.js';

type Models = components['schemas'];
export const users: Models['Users'] = {
  account: { id: 'a', manager: { id: 'b' } },
  team: { name: 'Engineering' },
  billing: { id: 42 },
};
// @ts-expect-error Folder namespaces keep unrelated User definitions distinct.
export const wrong: Models['models.User'] = { id: 42 };
