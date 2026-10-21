import oapi from '@typedapi/express';
import type { Router } from '@typedapi/express';
import { webHandler } from '@typedapi/openapi/contract';

declare const app: Router;
interface Payload {
  /** @minLength 2 */
  name: string;
  next?: Payload;
}
interface Maybe {
  query: { format?: 'text' | 'empty' };
  responses: { 200: { content?: { 'application/json': Payload; 'text/plain': string } } };
}
oapi.mount<Maybe>(app, {
  method: 'GET',
  path: '/maybe',
  operationId: 'maybe',
  handler(request, response) {
    if (request.query.format === 'empty') return response.end();
    if (request.query.format === 'text') return response.type('text/plain').send('ready');
    return response.cookie('session', 'value', { httpOnly: true }).json({ name: 'Ada' });
  },
});
/**
 * @route GET /web-maybe
 * @operationId webMaybe
 */
export const webMaybe = webHandler<Maybe>((request) => {
  const format = new URL(request.url).searchParams.get('format');
  if (format === 'empty') return { status: 200 };
  if (format === 'text') return { status: 200, contentType: 'text/plain', body: 'ready' };
  return { status: 200, contentType: 'application/json', body: { name: 'Ada' } };
});
