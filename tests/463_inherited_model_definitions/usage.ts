import type { components } from './schema.js';
type Dog = components['schemas']['Dog'];
const dog: Dog = { name: 'd', barks: true };
// @ts-expect-error Inherited members keep their declared contracts.
const wrong: Dog = { name: 1, barks: true };
void [dog, wrong];
