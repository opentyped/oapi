import type { components } from './schema.js';
type Settings = components['schemas']['Settings'];
const settings: Settings = { title: 't', weights: { a: 1 }, labels: { b: 'x' } };
// @ts-expect-error Open dictionaries keep their value types.
const wrong: Settings = { title: 't', weights: { a: '1' }, labels: {} };
void [settings, wrong];
