import type { components } from './schema.js';

type Models = components['schemas'];
export const rows: Models['ComposedRows'] = [[1, 2], [3]];
export const literals: Models['LiteralRows'] = [
  ['id', 1],
  ['id', 1],
];
export const matrix: Models['Matrix'] = [[1, 2], [3]];
// @ts-expect-error Composed item schemas still require nested arrays.
export const flatRows: Models['ComposedRows'] = [1, 2];
// @ts-expect-error An array of literal tuples cannot be flattened.
export const flatLiteral: Models['LiteralRows'] = ['id', 1];
// @ts-expect-error Each literal row must retain its exact values.
export const wrongLiteral: Models['LiteralRows'] = [['id', 2]];
