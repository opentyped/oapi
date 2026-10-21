import type { components } from './schema.js';
type Arity = components['schemas']['Arity'];
const arity: Arity = {
  required: ['s', 1],
  optional: ['s'],
  rest: [true, 'a', 'b'],
};
// @ts-expect-error Tuple arity keeps optional positions typed.
const wrong: Arity = { required: ['s', 1], optional: [1], rest: [true] };
void [arity, wrong];
