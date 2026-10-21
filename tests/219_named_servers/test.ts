import type { EmptyResponse } from '@typedapi/openapi';
import oapi from '@typedapi/express';
import type { Router } from '@typedapi/express';

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
