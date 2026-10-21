import type { User as ModelUser } from '@acme/spec/models';
import type { User as ApiUser } from '@acme/spec/api';
import type { schema } from '@acme/spec/api';
import type { Address } from '@acme/spec/models';
export type Referenced = Address;
const model: ModelUser = { id: '1', address: { street: 'Main' } };
model.manager = model;
const api: ApiUser = { record: model, label: 'user' };
type Get = schema['/users/{id}']['get'];
const params: Get['parameters']['path'] = { id: '1' };
const response: Get['responses'][200]['content']['application/json'] = api;
// @ts-expect-error Distinct User declarations retain distinct shapes.
const wrong: ApiUser = model;
// @ts-expect-error Path parameters are required and typed.
const missing: Get['parameters']['path'] = {};
// @ts-expect-error Undeclared URLs are not valid routes.
export type Unknown = schema['/missing'];
void [params, response, wrong, missing];

// @ts-expect-error A custom prefix does not register default-prefix modules.
import type { User as DefaultUser } from 'openapi/models';
export type DefaultPrefix = DefaultUser;

import { createClient } from 'typedapi/fetch';
const client = createClient<schema>({ baseUrl: 'https://example.com' });
export async function getUser(): Promise<ApiUser | undefined> {
  const response = await client('/users/{id}', { params: { id: '1' } });
  const clone: Response = response.clone();
  const text: string = await clone.text();
  void text;
  if (response.status === 200) return response.json();
  const unknown: unknown = await response.json();
  void unknown;
  return undefined;
}
// @ts-expect-error Unknown paths must be rejected.
void client('/missing');
// @ts-expect-error GET-only routes cannot be posted to.
void client('/users/{id}', { method: 'POST', params: { id: '1' } });
// @ts-expect-error Required path parameters cannot be omitted.
void client('/users/{id}');
// @ts-expect-error Parameter values retain their schema types.
void client('/users/{id}', { params: { id: 1 } });
// @ts-expect-error GET routes reject request bodies.
void client('/users/{id}', { params: { id: '1' }, body: {} });

import type { GetUserInput, GetUserResponse } from '@acme/spec/api';
const input: GetUserInput = { params: { id: '1' } };
const output: GetUserResponse = api;
void [input, output];
