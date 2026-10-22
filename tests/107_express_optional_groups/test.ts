import express from 'express';
import oapi from '@opentyped/oapi-express';
import type { EmptyResponse } from '@opentyped/oapi-openapi';

interface OptionalUser {
  params: { id?: string };
  responses: { 204: EmptyResponse };
}
interface Empty {
  responses: { 204: EmptyResponse };
}
const app = express();
oapi.mount<OptionalUser>(app, {
  method: 'GET',
  path: '/users{/:id}',
  handler(request, response) {
    response.set('X-Id', request.params.id ?? 'none').sendStatus(204);
  },
});
app.route('/status{.json}').get(
  oapi.handler<Empty>({
    handler(_request, response) {
      response.sendStatus(204);
    },
  }),
);
