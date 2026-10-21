import type { components } from './schema.js';
type Reading = components['schemas']['Reading'];
const reading: Reading = { state: null, count: null };
const active: Reading = { state: 'warn', count: 3 };
// @ts-expect-error Nullable members keep their literal types beside null.
const wrong: Reading = { state: 'alarm', count: null };
void [reading, active, wrong];
