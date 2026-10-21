import { Decimal } from 'decimal.js';
import type { Invoice } from './invoice';

const invoice: Invoice = {
  id: 'invoice-1',
  total: new Decimal('19.95'),
  adjustments: [new Decimal('-2.50')],
};
// Decimal.toJSON() emits strings; the config maps this same wire representation.
console.log(JSON.stringify(invoice));
