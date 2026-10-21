import type { components } from './schema.js';
type PortableName = components['schemas']['PortableName'];
const value: PortableName = { ok: true };
// @ts-expect-error Renamed schemas keep their contracts under the portable name.
const wrong: PortableName = { ok: 'yes' };
void [value, wrong];
