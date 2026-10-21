import type { operations } from './schema.js';
type Generate = operations['GenerateReport'];
declare const generate: Generate;
const job: string = generate.responses[202]['content']['application/json'].job;
const from: string = generate.requestBody['content']['application/json'].from;
// @ts-expect-error Route request bodies keep their declared fields.
const wrong: { note: string } = generate.requestBody['content']['application/json'];
void [job, from, wrong];
