import type { components } from './schema.js';
type Widget = components['schemas']['Widget'];
const widget: Widget = {
  name: 'w',
  tags: ['a'],
  settings: { weight: 1 },
  point: [1, 2],
  mode: 'on',
  child: { flag: true },
};
// @ts-expect-error Immutable definitions reject property reassignment.
widget.name = 'other';
// @ts-expect-error Immutable arrays reject indexed writes.
widget.tags[0] = 'b';
void widget;
