import type { EmptyResponse } from '@typedapi/openapi';
import oapi from '@typedapi/express';
import type { Router } from '@typedapi/express';

declare const app: Router;
interface Empty {
  responses: { 204: EmptyResponse };
}
oapi.mount<Empty>(app, {
  method: 'GET',
  path: '/one',
  operationId: 'one',
  tags: ['operation,one', 'shared'],
  handler(_request, response) {
    response.sendStatus(204);
  },
});
oapi.mount<Empty>(app, {
  method: 'GET',
  path: '/two',
  operationId: 'two',
  handler(_request, response) {
    response.sendStatus(204);
  },
});
