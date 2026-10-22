import express from 'express';
import oapi from '@opentyped/express';
interface Unavailable {
  responses: { 503: { body: string; contentType: 'text/plain' } };
}
export const app = express();
oapi.mount<Unavailable>(app, {
  method: 'GET',
  path: '/unavailable',
  operationId: 'unavailable',
  handler(_request, response) {
    response.set('Retry-After', '60').sendStatus(503);
  },
});
