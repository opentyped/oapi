import type { components } from './schema.js';
type Model = components['schemas']['Model'];
const model: Model = { flag: null, tags: null, explicit: null, nested: { inner: null } };
const filled: Model = { flag: 'f', tags: ['t'], explicit: 'e', nested: { inner: 1 } };
// @ts-expect-error Required objects reject null even when their members are nullable.
const wrong: Model = { flag: null, tags: null, explicit: null, nested: null };
void [model, filled, wrong];
