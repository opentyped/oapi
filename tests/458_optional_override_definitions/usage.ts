import type { components } from './schema.js';
type Form = components['schemas']['Form'];
const form: Form = { email: 'a@b.c' };
const full: Form = { nickname: 'n', email: 'a@b.c' };
// @ts-expect-error Required members reject undefined even beside optional overrides.
const wrong: Form = { nickname: 'n', email: undefined };
void [form, full, wrong];
