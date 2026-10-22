import oapi from '@opentyped/oapi-express';
import type { Router } from '@opentyped/oapi-express';

declare const app: Router;
interface Output {
  name: string;
}
interface Failure {
  message: string;
}
interface Profile {
  query: { format?: 'text'; fail?: boolean };
  responses: {
    200: { content: { 'application/json': Output; 'text/plain': string } };
    400: { body: Failure };
  };
}
oapi.mount<Profile>(app, {
  method: 'GET',
  path: '/profile',
  operationId: 'jsonpProfile',
  handler(request, response) {
    if (request.query.fail)
      return response.status(400).set('X-Result', 'error').jsonp({ message: 'Invalid profile' });
    if (request.query.format === 'text') return response.type('text/plain').send('ready');
    return response.cookie('session', 'value', { httpOnly: true }).jsonp({ name: 'Ada' });
  },
});
