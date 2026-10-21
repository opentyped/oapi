import type { components } from './schema.js';
type Drawing = components['schemas']['Drawing'];
const drawing: Drawing = { id: 'd', shape: { kind: 'circle', radius: 1 } };
// @ts-expect-error Nested discriminators keep their literal tags.
const wrong: Drawing = { id: 'd', shape: { kind: 'oval', radius: 1 } };
void [drawing, wrong];
