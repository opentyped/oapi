import oapi = require('@opentyped/oapi-express');
import type { Router } from '@opentyped/oapi-express';

declare const app: Router;
interface CommonJsPayload {
  id: string;
}
interface Read {
  params: { id: string };
  responses: { 200: { body: CommonJsPayload } };
}
interface Wrapped {
  responses: { 200: { body: CommonJsPayload } };
}
oapi.mount<Read>(app, {
  method: 'GET',
  path: '/commonjs/:id',
  operationId: 'commonJs',
  handler(request, response) {
    response.json({ id: request.params.id });
  },
});
app.get(
  '/wrapped',
  oapi.handler<Wrapped>({
    operationId: 'commonJsWrapped',
    handler(_request, response) {
      response.json({ id: 'wrapped' });
    },
  }),
);
