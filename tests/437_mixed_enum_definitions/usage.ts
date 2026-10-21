import type { components } from './schema.js';
type Flag = components['schemas']['Flag'];
const flag: Flag = { value: 1 };
// @ts-expect-error Mixed enums keep every literal member.
const wrong: Flag = { value: 'b' };
void [flag, wrong];
