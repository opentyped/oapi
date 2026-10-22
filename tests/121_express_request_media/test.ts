import express from 'express';
import oapi from '@opentyped/oapi-express';
import type { EmptyResponse } from '@opentyped/oapi-openapi';

interface TextInput {
  body: string;
  responses: { 204: EmptyResponse };
}
const app = express();
app.use(express.text());
const text = 'text/plain';
oapi.mount<TextInput>(app, {
  method: 'POST',
  path: '/text',
  operationId: 'writeText',
  requestContentType: text,
  handler(request, response) {
    response.set('X-Text', request.body).status(204).end();
  },
});
interface OptionalText {
  body?: string;
  responses: { 204: EmptyResponse };
}
app.post(
  '/optional-text',
  oapi.handler<OptionalText>({
    operationId: 'writeOptionalText',
    requestContentType: text,
    handler(_request, response) {
      response.status(204).end();
    },
  }),
);
