import oapi from '@opentyped/oapi-express';
import type { Router } from '@opentyped/oapi-express';
import type { User } from './api/user.js';

declare const app: Router;
oapi.mount<{ params: { id: string }; responses: { 200: { body: User } } }>(app, {
  method: 'GET',
  path: '/users/:id',
  operationId: 'getUser',
  handler(request, response) {
    response.json({
      record: { id: request.params.id, address: { street: 'Main' } },
      label: 'user',
    });
  },
});
