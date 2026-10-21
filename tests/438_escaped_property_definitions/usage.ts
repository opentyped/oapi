import type { components } from './schema.js';
type OddKeys = components['schemas']['OddKeys'];
const odd: OddKeys = { plain: 'p', 'with space': 1, '123': true, '0x': 'z' };
// @ts-expect-error Quoted member names keep their declared types.
const wrong: OddKeys = { plain: 'p', 'with space': 1, '123': true, '0x': 9 };
void [odd, wrong];
