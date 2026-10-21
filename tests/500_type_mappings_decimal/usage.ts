import type { components } from './schema.js';
import { Decimal } from 'decimal.js';

type Invoice = components['schemas']['Invoice'];
const total: Invoice['total'] = '123.45';
const history: Invoice['history'] = ['123.45'];
const nullable: Invoice['nullable'] = null;
const unrelated: Invoice['unrelated'] = { value: 'unchanged' };
// @ts-expect-error The JSON representation is a string, not a Decimal instance.
const object: Invoice['total'] = new Decimal(123);
// @ts-expect-error Number payloads do not implement the declared wire schema.
const number: Invoice['total'] = 123;
// @ts-expect-error Same-name unrelated types are not mapped.
const other: Invoice['unrelated'] = '123.45';
void [total, history, nullable, unrelated, object, number, other];
