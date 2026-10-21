import express from 'express';
import { handler as endpoint } from '@typedapi/express';

const app = express();
const api = express.Router();
const v2 = express.Router();
app.use('/api', api);
api.use('/v2', v2);

interface Entry {
  id: string;
}

v2.get(
  '/entries/:id',
  endpoint<{ params: { id: string } }, Entry>({
    operationId: 'readV2Entry',
    handler(request, response) {
      response.json({ id: request.params.id });
    },
  }),
);
