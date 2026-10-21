import type { User as AccountUser, UserPage } from 'openapi/accounts';
import type { User as BillingUser } from 'openapi/billing';

export const account: AccountUser = { id: '1', name: 'Ada', roles: ['reader'] };
export const billing: BillingUser = { id: 1, balance: 19.95 };
export const page: UserPage = { items: [{ id: account.id, name: account.name }] };
