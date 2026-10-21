import type { components } from './schema.js';
type WireEvent = components['schemas']['WireEvent'];
const event: WireEvent = { eventName: 'e', occurredAt: 't' };
// @ts-expect-error Renamed models keep their field value contracts.
const wrong: WireEvent = { eventName: 1, occurredAt: 't' };
void [event, wrong];
