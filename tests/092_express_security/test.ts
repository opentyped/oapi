import oapi from '@typedapi/express';
import type { EmptyResponse } from '@typedapi/openapi';
import express from 'express';

interface Accepted {
  responses: { 204: EmptyResponse };
}
const app = express();
const writeAccess = [{ oauth: ['users:write'], apiKey: [] }, { bearer: [] }] as const;
oapi.mount<Accepted>(app, {
  method: 'GET',
  path: '/inherited',
  operationId: 'inherited',
  handler(_request, response) {
    response.sendStatus(204);
  },
});
oapi.mount<Accepted>(app, {
  method: 'GET',
  path: '/public',
  operationId: 'public',
  security: [],
  handler(_request, response) {
    response.sendStatus(204);
  },
});
app.post(
  '/protected',
  oapi.handler<Accepted>({
    operationId: 'protected',
    security: writeAccess,
    handler(_request, response) {
      response.sendStatus(204);
    },
  }),
);
