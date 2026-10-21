import type { components } from './schema.js';
type Config = components['schemas']['settings.Config'];
const config: Config = {
  tags: ['one', 'two'],
  nested: { name: 'Ada' },
  empty: [],
  emptyObject: {},
};
const choice: components['schemas']['Choice'] = { values: [1] };
// @ts-expect-error Nested object properties remain readonly.
config.nested.name = 'Ada';
// @ts-expect-error Literal tuple elements remain readonly.
config.tags[0] = 'one';
// @ts-expect-error Empty literal arrays cannot grow.
config.empty.push();
// @ts-expect-error Nested enum arrays are readonly too.
choice.values[0] = 1;
// @ts-expect-error Empty literal tuples have length zero.
const nonEmpty: Config['empty'] = [undefined];
void nonEmpty;
