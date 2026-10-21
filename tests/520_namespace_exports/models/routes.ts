import oapi from '@typedapi/express';
import type { Router } from '@typedapi/express';
import type { User } from './user.js';
declare const app: Router;
oapi.mount<{ responses: { 200: { body: User } } }>(app, {
  method: 'GET',
  path: '/users',
  operationId: 'listUsers',
  handler(_request, response) {
    response.json({ id: '1', address: { street: 'Main' } });
  },
});
