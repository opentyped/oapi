import oapi from '@opentyped/express';
import type { Router } from '@opentyped/express';
import { webHandler } from '@opentyped/openapi/contract';

declare const app: Router;
interface Payload {
  name: string;
  next?: Payload;
}
interface Read {
  params: { id: string };
  responses: { 200: { body: Payload } };
}
oapi.mount<Read>(app, {
  method: 'HEAD',
  path: '/express/:id',
  operationId: 'headItem',
  handler(request, response) {
    response.set('X-Handler', 'head').json({ name: request.params.id });
  },
});
oapi.mount<Read>(app, {
  method: 'GET',
  path: '/express/:id',
  operationId: 'getItem',
  handler(request, response) {
    response.set('X-Handler', 'get').json({ name: request.params.id });
  },
});
/**
 * @route GET,HEAD /web/{id}
 * @operationId webItem
 */
export const webItem = webHandler<Read>(() => ({ status: 200, body: { name: 'Ada' } }));
