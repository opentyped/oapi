import type { operations } from './schema.js';

type Event = operations['expressEvents']['responses'][200]['itemContent']['application/jsonl'];
const event: Event = { id: 'one', next: { id: 'two' } };
// @ts-expect-error Framed stream items preserve their recursive payload type.
const wrong: Event = { id: 42 };
type Batch = operations['boundedEvents']['responses'][200]['content']['application/jsonl'];
const batch: Batch = [event];
// @ts-expect-error Aggregate stream payloads retain maxItems:2.
const oversized: Batch = [event, event, event];
// @ts-expect-error Aggregate and item payload types remain distinct.
const notBatch: Batch = event;
void [wrong, batch, notBatch, oversized];
