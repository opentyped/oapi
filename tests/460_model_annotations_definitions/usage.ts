import type { components } from './schema.js';
type State = components['schemas']['State'];
const state: State = { value: 'active' };
// @ts-expect-error Model annotations do not relax member contracts.
const wrong: State = { value: 1 };
void [state, wrong];
