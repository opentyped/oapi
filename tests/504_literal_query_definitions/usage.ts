import type { operations } from './schema.js';
type Read = operations['ReadFeed'];
declare const read: Read;
const format: 'rss' | 'atom' | undefined = read.parameters.query?.format;
const entries: number = read.responses[200]['content']['application/json'].entries;
// @ts-expect-error Literal query unions keep their members.
const wrong: Read['parameters']['query'] = { format: 'json' };
void [format, entries, wrong];
