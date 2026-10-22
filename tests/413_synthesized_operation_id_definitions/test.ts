import oapi from '@opentyped/express';
import type { Router } from '@opentyped/express';

declare const app: Router;

interface ReadInput {
  params: { id: string };
}
interface ReadOutput {
  results: string[];
}

oapi.mount<ReadInput, ReadOutput>(app, {
  method: 'GET',
  path: '/items/:id',
  handler(request, response) {
    return response.json({ results: [request.params.id] });
  },
});
