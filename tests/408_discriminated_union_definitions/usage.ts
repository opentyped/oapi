import type { components } from './schema.js';
type Shape = components['schemas']['Shape'];
declare const shape: Shape;
if (shape.kind === 'rectangle') {
  const width: number = shape.width;
  void width;
}
// @ts-expect-error Discriminator literals reject values outside the mapping.
const invalid: Shape = { kind: 'square', radius: 1 };
void [shape, invalid];
