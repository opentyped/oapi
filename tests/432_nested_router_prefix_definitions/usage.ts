import type { paths, operations } from './schema.js';
type Entry = paths['/api/v2/entries/{id}'];
declare const entry: Entry;
const viaPath: { id: string } = entry.get.responses[200]['content']['application/json'];
declare const read: operations['readV2Entry'];
const viaOperations: typeof viaPath = read.responses[200]['content']['application/json'];
// @ts-expect-error Nested prefixes merge into a single route path.
const wrong: { note: string } = entry.get.responses[200]['content']['application/json'];
void [viaPath, viaOperations, wrong];
