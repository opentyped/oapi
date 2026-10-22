import express from 'express';
import oapi from '@opentyped/oapi-express';
import type { EmptyResponse } from '@opentyped/oapi-openapi';

interface Empty {
  responses: { 204: EmptyResponse };
}
const app = express();
app.all(
  '/health',
  oapi.handler<Empty>({
    handler(_request, response) {
      response.sendStatus(204);
    },
  }),
);
const route = app.route('/ready');
route.all(
  oapi.handler<Empty>({
    handler(_request, response) {
      response.sendStatus(204);
    },
  }),
);
