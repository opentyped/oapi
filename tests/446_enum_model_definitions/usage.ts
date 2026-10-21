import type { components } from './schema.js';
type Color = components['schemas']['Color'];
type Painted = components['schemas']['Painted'];
const color: Color = 'green';
const painted: Painted = { color };
// @ts-expect-error Enum schemas keep their declared members.
const wrong: Color = 'blue';
void [color, painted, wrong];
