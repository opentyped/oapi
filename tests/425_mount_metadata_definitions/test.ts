import oapi from '@opentyped/express';
import type { Router } from '@opentyped/express';

declare const app: Router;

interface ReadContract {
  params: { id: string };
  responses: { 200: { body: { id: string } } };
}

oapi.mount<ReadContract>(app, {
  method: 'GET',
  path: '/meta/:id',
  operationId: 'readMeta',
  summary: 'Read metadata',
  description: 'Fetches the metadata record.',
  deprecated: true,
  tags: ['meta', 'read'],
  handler(request, response) {
    response.json({ id: request.params.id });
  },
});
