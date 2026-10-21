import type { components } from './schema.js';
type Model = components['schemas']['Model'];
const model: Model = {
  direct: { 'item.a.end': { id: 'x' } },
  literal: { 'literal-b': { id: 'y' } },
};
// @ts-expect-error Pattern-matched values must satisfy the referenced schema.
const wrong: Model = { direct: { 'item.a.end': { id: 1 } }, literal: {} };
void [model, wrong];
