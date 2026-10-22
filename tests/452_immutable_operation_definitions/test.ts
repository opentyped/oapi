import oapi from '@opentyped/oapi-express';
import type { Router } from '@opentyped/oapi-express';

declare const app: Router;

interface ReadContract {
  params: { id: string };
  responses: { 200: { body: { id: string } } };
}

oapi.mount<ReadContract>(app, {
  method: 'GET',
  path: '/frozen/:id',
  operationId: 'readFrozen',
  handler(request, response) {
    response.json({ id: request.params.id });
  },
});
