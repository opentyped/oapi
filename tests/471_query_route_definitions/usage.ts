import type { operations } from './schema.js';
type Query = operations['QueryReport'];
declare const query: Query;
const total: number = query.responses[200]['content']['application/json'].total;
// @ts-expect-error QUERY routes keep their query and payload contracts.
const wrong: { note: string } = query.responses[200]['content']['application/json'];
void [total, wrong];
