import { createClient, RequestBody } from '@opentyped/fetch';
import type { ClientResponse } from '@opentyped/fetch';
import type { schema } from 'openapi/routes';
const client = createClient<schema>({ baseUrl: 'https://example.com' });

export async function xml(): Promise<string> {
  const response = await client('/documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/xml', Accept: 'application/xml' },
    body: '<user><name>Ada</name></user>',
  });
  return response.text();
}

export async function binary(file: Blob): Promise<Blob> {
  await client('/files/{name}', {
    method: 'PUT',
    params: { name: 'data.bin' },
    headers: { 'Content-Type': 'application/octet-stream' },
    body: file,
  });
  const response = await client('/files/{name}', { params: { name: 'data.bin' } });
  const bytes: ArrayBuffer = await response.clone().arrayBuffer();
  void bytes;
  return response.blob();
}

export async function streaming(
  stream: ReadableStream<Uint8Array>,
): Promise<ReadableStream<Uint8Array> | null> {
  await client('/files/{name}', {
    method: 'PUT',
    params: { name: 'live.bin' },
    headers: { 'Content-Type': 'application/octet-stream' },
    body: stream,
  });
  const response = await client('/events', { headers: { Accept: 'text/event-stream' } });
  const reader = response.body?.getReader();
  if (reader) {
    const chunk: ReadableStreamReadResult<Uint8Array> = await reader.read();
    void chunk;
    reader.releaseLock();
  }
  return response.body;
}

export async function multipart(): Promise<Response> {
  const form = new FormData();
  form.set('name', 'Ada');
  return client('/forms', { method: 'POST', body: form });
}
// @ts-expect-error XML endpoints reject JSON encodings.
void client('/documents', { method: 'POST', body: RequestBody.fromJSON('<user />') });
void client('/files/{name}', {
  method: 'PUT',
  params: { name: 'data.bin' },
  // @ts-expect-error Binary uploads reject JSON encodings.
  body: RequestBody.fromJSON('bytes'),
});
// @ts-expect-error Multipart endpoints require native or explicitly encoded form data.
void client('/forms', { method: 'POST', body: { name: 'Ada' } });
// @ts-expect-error Required raw request bodies cannot be omitted.
void client('/documents', { method: 'POST' });

type XmlResponse = Extract<ClientResponse<schema['/documents']['post']>, { status: 201 }>;
type XmlJson = Awaited<ReturnType<XmlResponse['json']>>;
declare const xmlJson: XmlJson;
// @ts-expect-error An XML response does not declare a JSON body shape.
const wrongJson: { name: string } = xmlJson;
void wrongJson;
