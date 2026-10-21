import type { operations } from './schema.js';
type Read = operations['readFrozen'];
declare const read: Read;
const id: string = read.parameters.path.id;
// @ts-expect-error Immutable definitions reject property reassignment.
read.parameters.path.id = 'other';
// @ts-expect-error Immutable definitions keep their payload contracts.
const wrong: { note: string } = read.responses[200]['content']['application/json'];
void [id, wrong];
