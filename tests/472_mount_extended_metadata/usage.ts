import type { operations } from './schema.js';
type Read = operations['readDoc'];
declare const read: Read;
const id: string = read.responses[200]['content']['application/json'].id;
// @ts-expect-error Extended mount metadata does not alter payload contracts.
const wrong: { note: string } = read.responses[200]['content']['application/json'];
void [id, wrong];
