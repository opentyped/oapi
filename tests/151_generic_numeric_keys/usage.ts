import type { components } from './schema.js';

type Model = components['schemas']['Model'];

const valid: Model = { keys: 1, list: [1, '2', 'name'], forwarded: 'name' };
// @ts-expect-error Hidden source keys are excluded from serialized key arrays.
const hidden: Model['list'] = [3];
// @ts-expect-error Numeric and string literal keys remain distinct.
const numeric: Model['keys'] = 2;

void [valid, hidden, numeric];
