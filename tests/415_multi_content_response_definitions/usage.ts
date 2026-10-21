import type { operations } from './schema.js';
type Read = operations['readNegotiated'];
declare const read: Read;
const json: { id: string } = read.responses[200]['content']['application/json'];
const text: { note: string } = read.responses[200]['content']['text/plain'];
// @ts-expect-error Media types select distinct payload schemas.
const wrong: { id: string } = read.responses[200]['content']['text/plain'];
void [json, text, wrong];
