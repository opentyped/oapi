import type { operations } from './schema.js';
type End = operations['EndSession'];
declare const end: End;
const absent: undefined = end.responses[204]['content'];
// @ts-expect-error No-content DELETE responses carry no payload.
const wrong: { note: string } = end.responses[204]['content']['application/json'];
void [absent, wrong];
