import express from 'express';
import { handler as endpoint } from '@opentyped/express';

const app = express();

interface ReplaceInput {
  params: { id: string };
  body: { name: string };
}
interface ReplaceOutput {
  id: string;
  name: string;
}

app
  .route('/entries/:id')
  .get(
    endpoint<{ params: { id: string } }, { id: string }>({
      operationId: 'readEntry',
      handler(request, response) {
        response.json({ id: request.params.id });
      },
    }),
  )
  .put(
    endpoint<ReplaceInput, ReplaceOutput>({
      operationId: 'replaceEntry',
      handler(request, response) {
        response.json({ id: request.params.id, name: request.body.name });
      },
    }),
  );
