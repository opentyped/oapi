import type { User, Address, schema } from 'openapi/models';
import type { User as ApiUser, schema as ApiSchema } from 'openapi/api';
import { createClient } from 'typedapi/fetch';
const address: Address = { street: 'Main' };
const user: User = { id: '1', address };
const apiUser: ApiUser = { id: 1 };
const models = createClient<schema>();
const api = createClient<ApiSchema>();
void models('/users');
void api('/users', { method: 'POST', body: apiUser });
// @ts-expect-error Another namespace's method is not available on the same URL.
void models('/users', { method: 'POST', body: user });
// @ts-expect-error POST is required; this namespace does not own GET /users.
void api('/users');
// @ts-expect-error Namespaces retain their own User shape.
const wrong: User = apiUser;
void [user, wrong];
