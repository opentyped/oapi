import type { User as Account } from '../b/model.js';
/** @schema */
export interface User {
  account: Account;
  parent?: User;
}
