export type { User as AccountUser, User as SameAccountUser } from './src/models/user.js';
import type { User as AccountUser } from './src/models/user.js';
import type { User as TeamUser } from './src/models/team/user.js';
import type { User as BillingUser } from './src/models/billing/user.js';

/** @schema */
export interface Users {
  account: AccountUser;
  team: TeamUser;
  billing: BillingUser;
}
