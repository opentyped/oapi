import express from 'express';
import oapi from '@opentyped/express';
import type { EmptyResponse } from '@opentyped/openapi';

interface Search {
  body: string;
  responses: { 204: EmptyResponse };
}
const app = express();
app.use(express.json({ strict: false }));
app.get(
  '/search',
  oapi.handler<Search>({
    operationId: 'search',
    handler(request, response) {
      response.set('X-Search', request.body).status(204).end();
    },
  }),
);
app.head(
  '/probe',
  oapi.handler<Search>({
    operationId: 'probe',
    handler(request, response) {
      response.set('X-Search', request.body).status(204).end();
    },
  }),
);
