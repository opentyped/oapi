import type { components } from './schema.js';
type Model3d = components['schemas'][`3d_model`];
const model: Model3d = { vertices: 8 };
// @ts-expect-error Sanitized names keep their member contracts.
const wrong: Model3d = { vertices: '8' };
void [model, wrong];
