import type { components } from './schema.js';
type Button = components['schemas']['Button'];
const button: Button = { action: { label: 'press' }, enabled: true };
// @ts-expect-error Embedded schemas keep their declared constraints.
const wrong: Button = { action: { label: 'other' }, enabled: true };
void [button, wrong];
