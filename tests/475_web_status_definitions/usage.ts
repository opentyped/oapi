import type { operations } from './schema.js';
type Read = operations['readAsset'];
declare const read: Read;
const ok: { id: string } = read.responses[200]['content']['application/json'];
const absent: undefined = read.responses[404]['content'];
// @ts-expect-error Declared web statuses keep their payload contracts.
const wrong: { note: string } = read.responses[200]['content']['application/json'];
void [ok, absent, wrong];
