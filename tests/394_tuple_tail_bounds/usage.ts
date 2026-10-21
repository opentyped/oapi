import type { components } from './schema.js';

type Models = components['schemas'];
export const bounded: Models['Bounded'] = ['id', 1];
export const full: Models['Bounded'] = ['id', 1, 2];
export const required: Models['RequiredTail'] = ['id', 1, 2, 3];
// @ts-expect-error Required tail item is missing.
export const short: Models['RequiredTail'] = ['id', 1];
// @ts-expect-error Finite tail cannot exceed maxItems.
export const long: Models['Bounded'] = ['id', 1, 2, 3];
// @ts-expect-error Closed tuple cannot satisfy minItems.
export const impossible: Models['Impossible'] = ['id', 1];
