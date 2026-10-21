import type { operations } from './schema.js';
type Replace = operations['replaceEntry'];
declare const replace: Replace;
const name: string = replace.requestBody['content']['application/json'].name;
type Read = operations['readEntry'];
declare const read: Read;
const id: string = read.responses[200]['content']['application/json'].id;
// @ts-expect-error Read payloads do not carry request bodies.
const absent: Read['requestBody'] = name;
void [name, id, absent];
