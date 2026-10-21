import type { Tree as AccountTree } from './accounts.js';
import type { Tree as BillingTree } from './billing.js';

/** @schema */
export interface Pair {
  accounts: AccountTree;
  billing: BillingTree;
}
