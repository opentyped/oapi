import type { operations } from './schema.js';
type Read = operations['readShorthand'];
declare const read: Read;
const id: string = read.responses[200]['content']['application/json'].id;
// @ts-expect-error Declared response bodies keep their shape.
const wrong: { note: string } = read.responses[200]['content']['application/json'];
void [id, wrong];
