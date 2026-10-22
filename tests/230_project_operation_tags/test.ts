import type { EmptyResponse } from '@opentyped/oapi-openapi';
import oapi from '@opentyped/oapi-express';
import type { Router } from '@opentyped/oapi-express';

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
