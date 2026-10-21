import type { components } from './schema.js';
type Row = components['schemas']['Row'];
const row: Row = { title: 'r', cells: { 0: 'a' } };
// @ts-expect-error Numeric-indexed values keep their declared types.
const wrong: Row = { title: 'r', cells: { 0: 1 } };
void [row, wrong];
