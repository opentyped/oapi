import type { operations } from './schema.js';
type Patch = operations['PatchItem'];
declare const patch: Patch;
const id: string = patch.responses[200]['content']['application/json'].id;
// @ts-expect-error PATCH bodies keep their declared optionality and types.
const wrong: { note: string } = patch.requestBody['content']['application/json'];
void [id, wrong];
