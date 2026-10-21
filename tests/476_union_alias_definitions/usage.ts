import type { components } from './schema.js';
type Payment = components['schemas']['Payment'];
const payment: Payment = { kind: 'card', last4: '4242' };
// @ts-expect-error Union aliases keep every variant's contract.
const wrong: Payment = { kind: 'card', last4: 42 };
void [payment, wrong];
