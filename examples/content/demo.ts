import { createClient, RequestBody } from '@opentyped/oapi-fetch';
import type { schema } from 'openapi/transport';

// An in-process Fetch transport makes this demo runnable without a server.
const client = createClient<schema>({
  baseUrl: 'https://example.test',
  async fetch(input, init) {
    const request = new Request(input, init);
    if (new URL(request.url).pathname === '/events')
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('data: {"id":"1"}\n\n'));
            controller.close();
          },
        }),
        { headers: { 'Content-Type': 'text/event-stream' } },
      );
    if (request.headers.get('Content-Type')?.startsWith('multipart/form-data')) {
      const form = await request.formData();
      return Response.json({ name: form.get('name') });
    }
    return new Response(request.body, { headers: request.headers });
  },
});

const xml = await client('/documents', {
  method: 'POST',
  body: RequestBody.fromText('<user>Ada</user>', 'application/xml'),
});
console.log('XML:', await xml.text());

const binary = await client('/files/{name}', {
  method: 'PUT',
  params: { name: 'hello.txt' },
  body: RequestBody.fromNative(new Blob(['hello']), 'application/octet-stream'),
});
console.log('Binary:', await (await binary.blob()).text());

const form = new FormData();
form.set('name', 'Ada');
const submitted = await client('/forms', { method: 'POST', body: form });
console.log('Multipart:', await submitted.json());

const events = await client('/events');
// Read the native stream; an application can add its own SSE parser.
const reader = events.body?.getReader();
if (reader) {
  try {
    const { value } = await reader.read();
    console.log('SSE:', new TextDecoder().decode(value));
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}
