import type { EmptyResponse } from '@typedapi/openapi';
import oapi from '@typedapi/express';
import type { Router } from '@typedapi/express';

declare const app: Router;
interface Source {
  responses: {
    /** @http {"links":{"Target":{"operationRef":"#%2Fpaths%2F~1target%2Fget"}}} */
    204: EmptyResponse;
  };
}
interface Target {
  responses: { 204: EmptyResponse };
}
oapi.mount<Source>(app, {
  method: 'GET',
  path: '/source',
  operationId: 'source',
  handler(_request, response) {
    response.sendStatus(204);
  },
});
oapi.mount<Target>(app, {
  method: 'GET',
  path: '/target',
  operationId: 'target',
  handler(_request, response) {
    response.sendStatus(204);
  },
});
