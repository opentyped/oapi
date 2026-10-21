import type { components } from './schema.js';
type Payload = components['schemas']['Payload'];
const strings: Payload = { id: 'a', contents: ['x'] };
const numbers: Payload = { id: 'b', contents: [1] };
// @ts-expect-error Array unions keep their element contracts.
const wrong: Payload = { id: 'c', contents: [true] };
void [strings, numbers, wrong];
