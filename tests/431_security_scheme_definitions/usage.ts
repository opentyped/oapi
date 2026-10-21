import type { operations } from './schema.js';
type Read = operations['readSecure'];
declare const read: Read;
const id: string = read.parameters.path.id;
// @ts-expect-error Security requirements do not alter payload contracts.
const wrong: { note: string } = read.responses[200]['content']['application/json'];
void [id, wrong];
