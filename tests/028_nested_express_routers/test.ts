import express from 'express';
import { handler as endpoint } from '@opentyped/oapi-express';

const app = express();
const api = express.Router();
const users = express.Router();
const alias = users;
app.use('/api/', api);
api.use('/v1', [alias]);

interface User {
  id: string;
  manager?: User;
}
interface Input {
  params: { id: string };
}

const route = alias.route('/users/:id');
route.get(
  endpoint<Input, User>({
    operationId: 'readNestedUser',
    handler(request, response) {
      response.json({ id: request.params.id });
    },
  }),
);
