import type { operations } from './schema.js';
type Read = operations['readThing'];
declare const read: Read;
const id: string = read.responses[200]['content']['application/json'].id;
// @ts-expect-error Web contracts keep their declared payload shapes.
const wrong: { note: string } = read.responses[200]['content']['application/json'];
void [id, wrong];
