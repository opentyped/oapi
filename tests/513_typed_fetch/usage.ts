import { createClient } from '@opentyped/fetch';
import type { User } from 'openapi/models';
import type { schema } from 'openapi/routes';
import type { CreateUserInput, CreateUserResponse, CreateUserError } from 'openapi/api';
const client = createClient<schema>({ baseUrl: 'https://example.com' });
export async function usage(): Promise<void> {
  const users = await client('/users');
  if (users.status === 200) {
    const list: User[] = await users.json();
    void list;
  }
  const filtered = await client('/users', { query: { limit: 10 } });
  const input: CreateUserInput = {
    headers: { 'X-Trace': '1' },
    cookies: { session: 'token' },
    body: { name: 'Ada' },
  };
  const created = await client('/users', { method: 'POST', ...input });
  if (created.status === 201) {
    const user: User = await created.json();
    const output: CreateUserResponse = user;
    const ok: true = created.ok;
    const clone: CreateUserResponse = await created.clone().json();
    void [output, ok, clone];
  } else if (created.status === 400) {
    const error: CreateUserError = await created.json();
    const ok: false = created.ok;
    // @ts-expect-error Error bodies cannot be treated as successful User responses.
    const user: User = await created.json();
    void [error, ok, user];
  } else if (created.status === 503) {
    const unknown: unknown = await created.json();
    // @ts-expect-error Undocumented error statuses have unknown bodies.
    const error: CreateUserError = await created.json();
    void [unknown, error];
  } else if (created.status === 202) {
    // @ts-expect-error Undocumented success statuses also have unknown bodies.
    const user: User = await created.json();
    void user;
  }
  const queried = await client('/users', { method: 'QUERY', body: { name: 'Ada' } });
  const copied = await client('/users/{id}', { method: 'COPY', params: { id: '1' } });
  if (copied.status === 204) {
    const empty: never = await copied.json();
    void empty;
  }
  const text: string = await filtered.clone().text();
  const blob: Blob = await filtered.blob();
  const native: Response = created;
  void [queried, text, blob, native];
}
// @ts-expect-error Required request bodies and headers cannot be omitted.
void client('/users', { method: 'POST' });
// @ts-expect-error Required header/cookie groups cannot be omitted.
void client('/users', { method: 'POST', body: { name: 'Ada' } });
// @ts-expect-error Required bodies cannot be omitted.
void client('/users', { method: 'POST', headers: { 'X-Trace': '1' }, cookies: { session: 's' } });
// @ts-expect-error Request properties retain their declared types.
void client('/users', { method: 'QUERY', body: { name: 1 } });
// @ts-expect-error Raw native bodies cannot bypass a JSON request schema.
void client('/users', { method: 'QUERY', body: new FormData() });
// @ts-expect-error Query properties retain their declared types.
void client('/users', { query: { limit: '10' } });
// @ts-expect-error Unknown query properties cannot be passed.
void client('/users', { query: { offset: 10 } });
// @ts-expect-error Custom methods are case sensitive.
void client('/users/{id}', { method: 'copy', params: { id: '1' } });
// @ts-expect-error Custom requests cannot bypass route method checks.
void client('/users', { method: 'DELETE' });
// @ts-expect-error Only GET defaults may omit method; COPY must remain explicit.
void client('/users/{id}', { params: { id: '1' } });
// @ts-expect-error GET bodies are forbidden by Fetch.
void client('/users', { body: { name: 'Ada' } });

declare const method: 'GET' | 'QUERY';
// @ts-expect-error A method union may execute GET and cannot safely carry a payload.
void client('/users', { method, body: { name: 'Ada' } });
