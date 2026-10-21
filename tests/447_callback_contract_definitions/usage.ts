import type { operations } from './schema.js';
type StartCopy = operations['StartCopy'];
declare const copy: StartCopy;
const job: string = copy.responses[202]['content']['application/json'].job;
// @ts-expect-error Callbacks do not change the operation's payload contracts.
const wrong: { note: string } = copy.responses[202]['content']['application/json'];
void [job, wrong];
