import type { EmptyResponse } from '@opentyped/openapi';
import oapi from '@opentyped/express';
import type { Router } from '@opentyped/express';

declare const app: Router;
interface Status {
  responses: { 204: EmptyResponse };
}
oapi.mount<Status>(app, {
  method: 'GET',
  path: '/status',
  operationId: 'namedServer',
  servers: [{ url: 'https://internal.example.test', name: 'internal' }],
  handler(_request, response) {
    response.sendStatus(204);
  },
});
