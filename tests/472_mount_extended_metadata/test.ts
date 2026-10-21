import oapi from '@typedapi/express';
import type { Router } from '@typedapi/express';

declare const app: Router;

interface ReadContract {
  params: { id: string };
  responses: { 200: { body: { id: string } } };
}

oapi.mount<ReadContract>(app, {
  method: 'GET',
  path: '/docs/:id',
  operationId: 'readDoc',
  externalDocs: { url: 'https://docs.example.test/read' },
  servers: [{ url: 'https://api.example.test' }],
  extensions: { 'x-team': 'docs' },
  handler(request, response) {
    response.json({ id: request.params.id });
  },
});
