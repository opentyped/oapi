import type { components } from './schema.js';
type Summary = components['schemas']['Summary'];
const summary: Summary = { id: 'a', detail: { code: 1, label: 'ok' } };
// @ts-expect-error Inlined members keep their contracts without a reference.
const wrong: Summary = { id: 'a', detail: { code: '1', label: 'ok' } };
void [summary, wrong];
