import type { operations } from './schema.js';
type Legacy = operations['LegacyReport'];
declare const legacy: Legacy;
const total: number = legacy.responses[200]['content']['application/json'].total;
// @ts-expect-error Deprecated operations keep their response contracts.
const wrong: { note: string } = legacy.responses[200]['content']['application/json'];
void [total, wrong];
