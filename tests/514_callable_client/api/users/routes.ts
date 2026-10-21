import oapi from '@typedapi/express';
import type { Router } from '@typedapi/express';
import type { EmptyResponse } from '@typedapi/openapi';
import type { User } from '../../models/user.js';
declare const app: Router;
oapi.mount<{
  body: { user: User };
  responses: { 201: { body: User }; 422: { body: { message: string } } };
}>(app, {
  method: 'POST',
  path: '/users',
  operationId: 'createUser',
  handler(request, response) {
    response.status(201).json(request.body.user);
  },
});
/** @route GET /users */
export interface ListUsers {
  query: { tags?: string[] };
  responses: { '2XX': { body: User[] }; default: { body: { reason: string } } };
}
/** @route POST /drafts */
export interface SaveDraft {
  requestBody?: { content: { 'application/json': User; 'text/plain': string } };
  responses: { 204: EmptyResponse };
}
/** @route HEAD /health */
export interface Health {
  responses: { 200: { body: User } };
}
/** @route GET /text */
export interface ReadText {
  responses: { 200: { content: { 'text/plain': string } } };
}
