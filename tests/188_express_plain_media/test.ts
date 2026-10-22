import express from 'express';
import oapi from '@opentyped/oapi-express';

interface Unavailable {
  responses: { 503: { body: string; contentType: 'Text/Plain; charset=utf-8' } };
}
interface Ready {
  responses: {
    200: {
      content: { 'text/plain; charset=utf-8': string; 'application/json': { ready: boolean } };
    };
  };
}
export const app = express();
oapi.mount<Unavailable>(app, {
  method: 'GET',
  path: '/unavailable',
  operationId: 'Unavailable',
  handler(_request, response) {
    response.set('Retry-After', '60').sendStatus(503);
  },
});
app.get(
  '/ready',
  oapi.handler<Ready>({
    operationId: 'Ready',
    handler(_request, response) {
      response.sendStatus(200);
    },
  }),
);
