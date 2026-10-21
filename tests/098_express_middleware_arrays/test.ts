import express from 'express';
import type { RequestHandler } from 'express';
import oapi from '@typedapi/express';
import type { EmptyResponse } from '@typedapi/openapi';

interface Empty {
  responses: { 204: EmptyResponse };
}
const app = express();
const trace: RequestHandler = (_request, response, next) => {
  response.setHeader('X-Middleware', 'array');
  next();
};
app.get('/health', [
  trace,
  oapi.handler<Empty>({
    operationId: 'arrayHealth',
    handler(_request, response) {
      response.sendStatus(204);
    },
  }),
]);
const route = app.route('/ready');
route.post([
  trace,
  oapi.handler<Empty>({
    operationId: 'arrayReady',
    handler(_request, response) {
      response.sendStatus(204);
    },
  }),
]);
