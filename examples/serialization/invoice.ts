import type { Decimal } from 'decimal.js';

/** @schema */
export interface Invoice {
  id: string;
  total: Decimal;
  adjustments: Decimal[];
}
