import oapi from '@opentyped/oapi-express';
import type { Router } from '@opentyped/oapi-express';

declare const app: Router;

interface ReadContract {
  params: { id: string };
  responses: { 200: { body: { id: string } } };
}
interface UpdateContract {
  params: { id: string };
  body: { title: string };
  responses: { 200: { body: { id: string; title: string } } };
}

oapi.mount<ReadContract>(app, {
  method: 'GET',
  path: '/things/:id',
  operationId: 'readThing',
  handler(request, response) {
    response.json({ id: request.params.id });
  },
});
oapi.mount<UpdateContract>(app, {
  method: 'POST',
  path: '/things/:id',
  operationId: 'updateThing',
  handler(request, response) {
    response.json({ id: request.params.id, title: request.body.title });
  },
});
