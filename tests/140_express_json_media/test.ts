import express from 'express';
import oapi from '@opentyped/oapi-express';
interface User {
  /** @minLength 2 */
  name: string;
}
interface Profile {
  query: { format?: 'json' | 'text' };
  responses: { 200: { content: { 'application/json': User; 'text/plain': string } } };
}
export const app = express();
oapi.mount<Profile>(app, {
  method: 'GET',
  path: '/profile',
  operationId: 'profile',
  handler(request, response) {
    if (request.query.format === 'text') return response.type('text/plain').send('ready');
    return response.json({ name: 'Ada' });
  },
});
