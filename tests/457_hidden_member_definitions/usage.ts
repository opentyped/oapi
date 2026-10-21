import type { components } from './schema.js';
type Mixed = components['schemas']['Mixed'];
const mixed: Mixed = { visible: 'v' };
// @ts-expect-error Hidden members stay out of the generated contracts.
const wrong: Mixed = { visible: 'v', secret: 's' };
void [mixed, wrong];
