import type { operations } from './schema.js';
type Read = operations['readMeta'];
declare const read: Read;
const id: string = read.parameters.path.id;
// @ts-expect-error Deprecated operations keep their payload contracts.
const wrong: { note: string } = read.responses[200]['content']['application/json'];
void [id, wrong];
