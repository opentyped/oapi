import type { components, operations } from './schema.js';
type Item = components['responses']['ItemResponse']['content']['application/json'];
const item: Item = { id: 'one' };
type Found = operations['readItem']['responses']['200']['content']['application/json'];
const found: Found = { id: 'two' };
// @ts-expect-error Problem payloads are not item payloads.
const wrong: Item = { message: 'nope' };
// @ts-expect-error Path parameters are required.
const missing: operations['readItem']['parameters']['path'] = {};
void [item, found, wrong, missing];
