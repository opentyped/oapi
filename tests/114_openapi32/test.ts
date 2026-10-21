import express from 'express';
import oapi from '@typedapi/express';

interface User {
  id: string;
  manager?: User;
}
interface ReadUser {
  params: { id: string };
  responses: { 200: { body: User } };
}
const app = express();
oapi.mount<ReadUser>(app, {
  method: 'GET',
  path: '/users/:id',
  operationId: 'readUser',
  tags: ['users', 'staff'],
  handler(request, response) {
    response.json({ id: request.params.id });
  },
});
