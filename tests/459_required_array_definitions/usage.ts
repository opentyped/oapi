import type { components } from './schema.js';
type Team = components['schemas']['Team'];
const team: Team = { name: 'n', owner: 'o' };
// @ts-expect-error Array-form required overrides name both members required.
const wrong: Team = { name: 'n' };
void [team, wrong];
