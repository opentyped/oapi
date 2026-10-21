import type { components } from './schema.js';
type Model = components['schemas']['Model'];
const model: Model = { state: 'active', mode: 'off' };
// @ts-expect-error Enum members are literal types.
const wrong: Model = { state: 'pending', mode: 'off' };
void [model, wrong];
