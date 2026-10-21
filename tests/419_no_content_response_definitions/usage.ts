import type { operations } from './schema.js';
type Delete = operations['deleteItem'];
declare const del: Delete;
// @ts-expect-error No-content responses carry no payload schema.
const wrong: { note: string } = del.responses[204]['content']['application/json'];
void wrong;
