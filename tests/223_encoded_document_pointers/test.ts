import type { EmptyResponse } from '@opentyped/oapi-openapi';
import oapi from '@opentyped/oapi-express';
import type { Router } from '@opentyped/oapi-express';

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
