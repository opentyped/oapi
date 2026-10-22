import { createClient } from '@opentyped/fetch';
import type { schema } from '@app/spec/routes';
import type { User } from '@app/spec/models';
import type {
  CreateUserInput,
  CreateUserResponse,
  CreateUserError,
  ListUsersResponse,
  ListUsersError,
  SaveDraftInput,
} from '@app/spec/api/users';
import { Decimal } from 'decimal.js';
// @ts-expect-error Endpoint input types are not model exports.
import type { CreateUserInput as Misplaced } from '@app/spec/models';
export type InvalidImport = Misplaced;
const client = createClient<schema>({ baseUrl: 'https://example.com' });
const user: User = { id: '1', balance: '1.50' };
user.manager = user;
const input: CreateUserInput = { body: { user } };
export async function usage(): Promise<void> {
  const created = await client('/users', { method: 'POST', ...input });
  if (created.status === 201) {
    const value: CreateUserResponse = await created.json();
    const balance: string = value.balance;
    void balance;
  } else if (created.status === 422) {
    const value: CreateUserError = await created.json();
    const message: string = value.message;
    void message;
  } else {
    // @ts-expect-error Unexpected statuses do not inherit declared bodies.
    const value: CreateUserResponse = await created.json();
    void value;
  }
  const listed = await client('/users', { query: { tags: ['active'] } });
  if (listed.ok) {
    const users: User[] = await listed.json();
    const output: ListUsersResponse = users;
    void output;
  } else {
    const error: ListUsersError = await listed.json();
    const reason: string = error.reason;
    void reason;
  }
  if (listed.status === 202) {
    const users: User[] = await listed.json();
    void users;
  }
  const optional = await client('/drafts', { method: 'POST' });
  const json = await client('/drafts', { method: 'post', body: user });
  const raw = await client('/drafts', {
    method: 'POST',
    body: 'draft',
    headers: { 'Content-Type': 'text/plain' },
  });
  const head = await client('/health', { method: 'HEAD' });
  const empty: never = await head.json();
  const text = await client('/text');
  const string: string = await text.text();
  const unknown: unknown = await text.clone().json();
  void [optional, json, raw, empty, string, unknown];
}
// @ts-expect-error Symbol-based serialization mapping requires wire strings, not class instances.
void client('/users', { method: 'POST', body: { user: { id: '1', balance: new Decimal(1) } } });
// @ts-expect-error Endpoint input shapes reference model definitions.
const wrongInput: CreateUserInput = { body: { user: { id: '1', balance: 1 } } };
// @ts-expect-error Optional wire bodies retain the model or text schema.
const doubleInput: SaveDraftInput = { body: { id: '1' } };
// @ts-expect-error Only declared verbs are accepted on the selected path.
void client('/drafts', { method: 'GET' });
// @ts-expect-error Optional bodies still retain their schema types.
void client('/drafts', { method: 'POST', body: { id: '1' } });
// @ts-expect-error HEAD cannot carry request payloads.
void client('/health', { method: 'HEAD', body: 'payload' });
void [wrongInput, doubleInput];

declare const eitherPath: '/users' | '/drafts';
// @ts-expect-error A variable path cannot assume that every possible route supports GET.
void client(eitherPath, { method: 'GET' });
// @ts-expect-error Payloads must work for every possible route, not just one branch.
void client(eitherPath, { method: 'POST', body: user });
