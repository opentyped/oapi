import type { components } from './schema.js';

type AccountUser = components['schemas']['accounts.User'];
type BillingUser = components['schemas']['billing.User'];

const account: AccountUser = { id: 'account', manager: { id: 'manager' } };
const billing: BillingUser = { id: 42, manager: { id: 17 } };
// @ts-expect-error Same local schema name does not make their identities interchangeable.
const wrongAccount: AccountUser = billing;
// @ts-expect-error Recursive references stay inside their namespace.
const wrongManager: AccountUser = { id: 'account', manager: billing };
// @ts-expect-error The billing identifier remains numeric.
const wrongBilling: BillingUser = account;
void [wrongAccount, wrongManager, wrongBilling];
