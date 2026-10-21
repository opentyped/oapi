import type { components } from './schema.js';
type Flexible = components['schemas']['Flexible'];
const flexible: Flexible = { id: 'a', extras: { any: 'thing' } };
// @ts-expect-error Declared fields keep their requiredness.
const wrong: Flexible = { extras: null };
void [flexible, wrong];
