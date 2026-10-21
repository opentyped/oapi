import type { components } from './schema.js';
type Defaults = components['schemas']['Defaults'];
const value: Defaults = { default: 'd', const: 1, enum: true };
// @ts-expect-error Keyword-named properties keep their declared types.
const wrong: Defaults = { default: 'd', const: 1, enum: 'true' };
void [value, wrong];
