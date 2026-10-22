import { createClient, RequestBody } from '@opentyped/fetch';
import type { schema } from 'openapi/routes';
import type { User, UpdateUserInput } from 'openapi/api/users';
const client = createClient<schema>({ baseUrl: 'https://example.com' });
const params = { id: '1' };
const headers = { 'X-Revision': 1 };
const user: User = { id: '1', name: 'Ada' };
const wire: UpdateUserInput = { params, headers, body: { name: 'Ada' } };

export async function usage(): Promise<void> {
  await client('/users/{id}', { params, headers: { 'X-Tenant': 'a' }, query: { expand: 'teams' } });
  await client('/users/{id}', {
    method: 'PATCH',
    params,
    headers,
    query: { notify: true },
    body: { name: 'Ada' },
  });
  const encoded = RequestBody.fromJSON({ name: 'Ada' });
  const retained: RequestBody<{ readonly name: 'Ada' }, 'application/json'> = encoded;
  await client('/users/{id}', { method: 'PATCH', params, headers, body: retained });
  await client('/users/{id}', {
    method: 'PATCH',
    params,
    headers,
    body: RequestBody.fromJSON({ label: 'Ada' }, 'application/vnd.user+json'),
  });
  await client('/users/{id}', {
    method: 'PATCH',
    params,
    headers: { ...headers, 'Content-Type': 'application/vnd.user+json' },
    body: { label: 'Ada' },
  });
  await client('/users/{id}', {
    method: 'PATCH',
    params,
    headers,
    body: RequestBody.fromJSON({ name: 'Ada' }),
  });
  await client('/users/{id}', {
    method: 'PATCH',
    params,
    headers,
    body: RequestBody.encode(
      { display: 'Ada' },
      'application/xml',
      (value) => `<user>${value.display}</user>`,
    ),
  });
  await client('/users/{id}', {
    method: 'PATCH',
    params,
    headers,
    body: RequestBody.fromText('<user>Ada</user>', 'application/xml'),
  });
  await client('/users/{id}', {
    method: 'PATCH',
    params,
    headers,
    body: RequestBody.fromText('Ada'),
  });
  await client('/users/{id}', {
    method: 'PATCH',
    params,
    headers: { ...headers, 'content-type': 'text/plain; charset=utf-8' },
    body: 'Ada',
  });
  await client('/users/{id}', {
    method: 'PATCH',
    params,
    headers,
    body: RequestBody.fromNative(new Blob(['data']), 'application/octet-stream'),
  });
  await client('/users/{id}', {
    method: 'POST',
    params: { id: 1 },
    query: { priority: 2 },
    body: { active: true },
  });
  await client('/users/{id}', { method: 'PUT', params, body: RequestBody.fromJSON('Ada') });
  await client('/users/{id}', { method: 'PUT', params, body: RequestBody.fromJSON(null) });
  await client('/batch', { method: 'POST', body: [user] });
  await client('/batch', { method: 'POST', body: RequestBody.fromJSON([user]) });
  await client('/metadata', { method: 'POST', body: { size: 1, type: 'image/png' } });
  void wire;
}
void client('/users/{id}', {
  method: 'POST',
  // @ts-expect-error Method selects the parameter shape, not just the URL template.
  params,
  query: { priority: 1 },
  body: { active: true },
});
// @ts-expect-error GET selects its own required headers.
void client('/users/{id}', { params, headers });
void client('/users/{id}', {
  method: 'PATCH',
  params,
  headers,
  // @ts-expect-error PATCH does not inherit GET query fields.
  query: { expand: 'teams' },
  body: { name: 'Ada' },
});
void client('/users/{id}', {
  method: 'PATCH',
  params,
  headers,
  // @ts-expect-error The JSON value must match this method's JSON schema.
  body: RequestBody.fromJSON({ active: true }),
});
void client('/users/{id}', {
  method: 'PATCH',
  params,
  headers,
  // @ts-expect-error JSON factory arguments retain their value types.
  body: RequestBody.fromJSON({ name: 1 }),
});
void client('/users/{id}', {
  method: 'PATCH',
  params,
  headers,
  // @ts-expect-error Vendor JSON content selects label rather than name.
  body: RequestBody.fromJSON({ name: 'Ada' }, 'application/vnd.user+json'),
});
// @ts-expect-error Plain objects default to application/json, not vendor JSON.
void client('/users/{id}', { method: 'PATCH', params, headers, body: { label: 'Ada' } });
// @ts-expect-error The selected content type determines the plain object's payload schema.
void client('/users/{id}', {
  method: 'PATCH',
  params,
  headers: { ...headers, 'Content-Type': 'application/vnd.user+json' },
  body: { name: 'Ada' },
});
// @ts-expect-error Explicit encoding and header content type must agree.
void client('/users/{id}', {
  method: 'PATCH',
  params,
  headers: { ...headers, 'Content-Type': 'text/plain' },
  body: RequestBody.fromJSON({ name: 'Ada' }),
});
void client('/users/{id}', {
  method: 'PATCH',
  params,
  headers,
  // @ts-expect-error The request does not declare HTML.
  body: RequestBody.fromText('<p>Ada</p>', 'text/html'),
});
void client('/users/{id}', {
  method: 'PATCH',
  params,
  headers,
  // @ts-expect-error A custom XML encoder retains its original value schema.
  body: RequestBody.encode(
    { name: 'Ada' },
    'application/xml',
    (value) => `<user>${value.name}</user>`,
  ),
});
// @ts-expect-error Raw strings cannot bypass a JSON-only body schema.
void client('/users/{id}', { method: 'PUT', params, body: 'Ada' });
void client('/users/{id}', {
  method: 'PUT',
  params,
  headers: { 'Content-Type': 'application/json' },
  // @ts-expect-error Raw JSON cannot be relabeled to bypass JSON value checking.
  body: '"Ada"',
});
// @ts-expect-error JSON primitives require an explicit JSON encoding.
void client('/users/{id}', { method: 'PUT', params, body: null });
// @ts-expect-error Text encoding cannot impersonate JSON encoding.
RequestBody.fromText('{}', 'application/json');
// @ts-expect-error Native encoding cannot impersonate JSON encoding.
RequestBody.fromNative('{}', 'application/json');
// @ts-expect-error The JSON factory does not accept XML media types.
RequestBody.fromJSON({ name: 'Ada' }, 'application/xml');
// @ts-expect-error A Blob must not structurally match a JSON metadata record.
void client('/metadata', { method: 'POST', body: new Blob(['data']) });
// @ts-expect-error Factory wrapping cannot turn binary metadata into a valid JSON value.
void client('/metadata', { method: 'POST', body: RequestBody.fromJSON(new Blob(['data'])) });
// @ts-expect-error The separate json option no longer exists.
void client('/batch', { method: 'POST', json: [user] });
// @ts-expect-error Private branding prevents a fabricated encoder object.
void client('/batch', {
  method: 'POST',
  body: { contentType: 'application/json', toBody: () => '[]' },
});

export async function parameterizedMedia(): Promise<void> {
  await client('/users/{id}', {
    method: 'PATCH',
    params,
    headers,
    body: RequestBody.fromJSON({ short: 'Ada' }, 'application/json;profile=short'),
  });
  await client('/users/{id}', {
    method: 'PATCH',
    params,
    headers: { ...headers, 'Content-Type': 'application/json;profile=long' },
    body: { long: 1 },
  });
  await client('/batch', {
    method: 'POST',
    body: RequestBody.fromJSON([user], 'Application/JSON; charset=utf-8'),
  });
}
void client('/users/{id}', {
  method: 'PATCH',
  params,
  headers,
  // @ts-expect-error A general JSON representation cannot swallow a declared profile's schema.
  body: RequestBody.fromJSON({ name: 'Ada' }, 'application/json;profile=short'),
});
// @ts-expect-error Profile headers select their own payload shape.
void client('/users/{id}', {
  method: 'PATCH',
  params,
  headers: { ...headers, 'Content-Type': 'application/json;profile=long' },
  body: { name: 'Ada' },
});

class CustomEncoding {
  name = 'Ada';
  toJSON(): string {
    return 'a different wire shape';
  }
}
void client('/users/{id}', {
  method: 'PATCH',
  params,
  headers,
  // @ts-expect-error A custom toJSON transformation does not prove the declared JSON wire shape.
  body: RequestBody.fromJSON(new CustomEncoding()),
});
