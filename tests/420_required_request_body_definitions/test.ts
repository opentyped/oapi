import oapi from '@opentyped/express';
import type { Router } from '@opentyped/express';

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
