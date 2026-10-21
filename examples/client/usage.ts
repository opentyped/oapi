import { createClient } from 'typedapi/fetch';
import type { User } from 'openapi/models';
import type { schema, CreateUserInput } from 'openapi/api';

const client = createClient<schema>({ baseUrl: 'http://localhost:3000' });

export async function createUser(name: CreateUserInput['body']['name']): Promise<User> {
  const response = await client('/users', {
    method: 'POST',
    headers: { 'x-request-id': 'example' },
    body: { name }, // Plain objects become JSON; no separate json option.
  });
  if (response.status === 201) return response.json();
  throw new Error(`Unexpected status: ${response.status}`);
}

export async function getUser(id: string): Promise<User | undefined> {
  const response = await client('/users/{id}', { params: { id }, query: { greeting: 'Hi' } });
  if (response.status === 200) return response.json();
  if (response.status === 404) {
    const error = await response.json(); // { message: string }
    console.log(error.message);
    return undefined;
  }
  throw new Error(`Unexpected status: ${response.status}`);
}
