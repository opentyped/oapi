import type { components } from './schema.js';

type Models = components['schemas'];
export const bounded: Models['Bounded'] = [1, 2];
export const nonempty: Models['Nonempty'] = ['a', 'b'];
export const empty: Models['Empty'] = [];
export const zero: Models['Zero'] = [];
// @ts-expect-error minItems requires at least one item.
export const short: Models['Nonempty'] = [];
// @ts-expect-error maxItems prohibits a third item.
export const long: Models['Bounded'] = [1, 2, 3];
// @ts-expect-error items:false prohibits items.
export const forbidden: Models['Empty'] = [1];
// @ts-expect-error Closed empty array cannot satisfy minItems.
export const impossible: Models['Impossible'] = [];
// @ts-expect-error maxItems:0 prohibits items.
export const nonzero: Models['Zero'] = ['a'];
// @ts-expect-error Bounded arrays preserve immutable output.
bounded[0] = 3;

export const closed: Models['Closed'] = [];
// @ts-expect-error items:false permits only the empty tuple, even with a larger maxItems.
export const undefinedItem: Models['Closed'] = [undefined];
