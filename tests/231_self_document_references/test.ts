import type { EmptyResponse } from '@opentyped/openapi';
import oapi from '@opentyped/express';
import type { Router } from '@opentyped/express';

declare const app: Router;
interface Empty {
  responses: {
    /** @http {"links":{"Target":{"operationRef":"https://example.test/api/openapi.json#/paths/~1two/get"}}} */
    204: EmptyResponse;
  };
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
