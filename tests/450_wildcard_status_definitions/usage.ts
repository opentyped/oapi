import type { operations } from './schema.js';
type Read = operations['ReadRates'];
declare const read: Read;
const value: number = read.responses['2XX']['content']['application/json'].value;
const reason: string = read.responses.default['content']['application/json'].reason;
// @ts-expect-error Wildcard statuses keep their declared payload contracts.
const wrong: { note: string } = read.responses['2XX']['content']['application/json'];
void [value, reason, wrong];
