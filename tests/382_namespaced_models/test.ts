export { User as AccountUser } from './accounts.js';
export { User as SameAccountUser } from './accounts.js';
export { User as BillingUser } from './billing.js';

import type { User as AccountUser } from './accounts.js';
import type { User as BillingUser } from './billing.js';

/** @schema */
export interface Users {
  account: AccountUser;
  billing: BillingUser;
}
