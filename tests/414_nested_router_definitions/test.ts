import express from 'express';
import { handler as endpoint } from '@typedapi/express';

const app = express();
const api = express.Router();
app.use('/api/', api);

interface User {
  id: string;
  manager?: User;
}
interface Input {
  params: { id: string };
}

api.get(
  '/users/:id',
  endpoint<Input, User>({
    operationId: 'readApiUser',
    handler(request, response) {
      response.json({ id: request.params.id });
    },
  }),
);
