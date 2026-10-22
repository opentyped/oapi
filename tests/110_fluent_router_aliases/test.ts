import express from 'express';
import oapi from '@opentyped/express';
import type { EmptyResponse } from '@opentyped/openapi';

interface Empty {
  responses: { 204: EmptyResponse };
}
const app = express();
const parent = express.Router();
const child = express.Router();
const childAlias = child.use((_request, _response, next) => next());
const parentAlias = parent['use']('/child', childAlias);
app.use('/api', parentAlias);
oapi.mount<Empty>(child, {
  method: 'GET',
  path: '/ping',
  operationId: 'ping',
  handler(_request, response) {
    response.sendStatus(204);
  },
});
const fluent = express.Router();
const fluentAlias = fluent['get']('/unannotated', (_request, response) => {
  response.sendStatus(204);
});
app.use('/other', fluentAlias);
fluent.get(
  '/status',
  oapi.handler<Empty>({
    operationId: 'status',
    handler(_request, response) {
      response.sendStatus(204);
    },
  }),
);
