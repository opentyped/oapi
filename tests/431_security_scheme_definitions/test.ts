import oapi from '@typedapi/express';
import type { Router } from '@typedapi/express';

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
