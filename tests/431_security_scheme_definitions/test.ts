import oapi from '@opentyped/express';
import type { Router } from '@opentyped/express';

declare const app: Router;

interface ReadContract {
  params: { id: string };
  responses: { 200: { body: { id: string } } };
}

oapi.mount<ReadContract>(app, {
  method: 'GET',
  path: '/secure/:id',
  operationId: 'readSecure',
  security: [{ apiKey: [] }],
  handler(request, response) {
    response.json({ id: request.params.id });
  },
});
