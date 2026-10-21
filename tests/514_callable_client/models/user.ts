import type { Decimal } from 'decimal.js';
/** @schema */
export interface User {
  id: string;
  balance: Decimal;
  manager?: User;
}
