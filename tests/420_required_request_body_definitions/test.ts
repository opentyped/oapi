import oapi from '@opentyped/oapi-express';
import type { Router } from '@opentyped/oapi-express';

declare const app: Router;

interface CreateInput {
  body: { title: string };
}
interface CreateOutput {
  id: string;
}

oapi.mount<CreateInput, CreateOutput>(app, {
  method: 'POST',
  path: '/items',
  operationId: 'createItem',
  handler(request, response) {
    return response.json({ id: request.body.title });
  },
});
