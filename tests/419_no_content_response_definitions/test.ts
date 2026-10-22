import oapi from '@opentyped/oapi-express';
import type { Router } from '@opentyped/oapi-express';
import type { EmptyResponse } from '@opentyped/oapi-openapi';

declare const app: Router;

interface DeleteContract {
  params: { id: string };
  responses: {
    /** No content. */
    204: EmptyResponse;
  };
}

oapi.mount<DeleteContract>(app, {
  method: 'DELETE',
  path: '/items/:id',
  operationId: 'deleteItem',
  handler(_request, response) {
    response.sendStatus(204);
  },
});
