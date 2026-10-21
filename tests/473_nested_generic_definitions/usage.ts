import type { components } from './schema.js';
type StringBox = components['schemas']['StringBox'];
const box: StringBox = {
  plain: { value: 'v', label: 'l' },
  pair: { value: { left: 1, right: 2 }, label: 'p' },
};
// @ts-expect-error Instantiated generics keep their argument contracts.
const wrong: StringBox = { plain: { value: 1 }, pair: { value: { left: 1 } } };
void [box, wrong];
