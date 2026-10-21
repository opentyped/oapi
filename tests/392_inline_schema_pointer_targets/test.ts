export type { User } from './accounts.js';

/** @schema */
export interface Result {
  /** @inline @ref #/components/schemas/accounts.User/properties/name */
  name: unknown;
  /** @inline @ref #%2Fcomponents%2Fschemas%2Faccounts.User%2Fproperties%2Fitems%2Fitems */
  score: unknown;
  /** @inline @ref #/components/schemas/accounts.User/properties/meta */
  meta: unknown;
  /** @inline @ref #/components/schemas/accounts.User/properties/blocked */
  blocked?: unknown;
}
