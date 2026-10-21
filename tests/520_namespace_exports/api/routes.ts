import oapi from '@typedapi/express';
import type { Router } from '@typedapi/express';
import type { User } from './user.js';
declare const app: Router;
oapi.mount<{ body: User; responses: { 201: { body: User } } }>(app, {
  method: 'POST',
  path: '/users',
  operationId: 'createUser',
  handler(request, response) {
    response.status(201).json(request.body);
  },
});
