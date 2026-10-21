import type { User as Admin } from './a.js';
import type { User as Customer } from './b.js';

/** @schema */
export interface Model {
  admin: Admin;
  customer: Customer;
}
