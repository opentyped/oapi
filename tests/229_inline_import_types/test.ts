import oapi from '@typedapi/express';
import type { Router } from '@typedapi/express';

declare const app: Router;
/** @schema */
export type Model = import('./barrel.js').Box<import('./barrel.js').Domain.User>;

oapi.mount<import('./model.js').Read>(app, {
  method: 'GET',
  path: '/users',
  operationId: 'read',
  handler(_request, response) {
    response.json([{ name: 'Ada' }]);
  },
});
