import express from 'express';
import oapi from '@opentyped/oapi-express';
import type { EmptyResponse } from '@opentyped/oapi-openapi';

interface ReceivedEvent {
  id: string;
  type: 'user.created' | 'user.updated';
  previous?: ReceivedEvent;
}
interface ReceiveEvent {
  body: ReceivedEvent;
  responses: { 204: EmptyResponse };
}

export const app = express();
app.use(express.json());
app.post(
  '/events',
  oapi.handler<ReceiveEvent>({
    operationId: 'receiveEvent',
    handler(_request, response) {
      response.status(204).end();
    },
  }),
);
