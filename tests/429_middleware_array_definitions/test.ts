import express from 'express';
import { handler as endpoint } from '@opentyped/oapi-express';

const app = express();

interface ReadInput {
  params: { id: string };
}
interface ReadOutput {
  id: string;
}

app.get(
  '/short/:id',
  ((_request, _response, next) => next()) as express.RequestHandler,
  endpoint<ReadInput, ReadOutput>({
    operationId: 'readShorthand',
    handler(request, response) {
      response.json({ id: request.params.id });
    },
  }),
);
