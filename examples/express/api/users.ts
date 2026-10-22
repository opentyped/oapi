import type { Express } from 'express';
import oapi from '@opentyped/oapi-express';
import type { JsonResponse } from '@opentyped/oapi-openapi';
import type { User } from '../models/user';

interface GetUser {
  params: { id: string };
  query: { greeting?: string };
  responses: {
    200: JsonResponse<User>;
    404: JsonResponse<{ message: string }>;
  };
}
interface CreateUser {
  headers: { 'x-request-id': string };
  body: Pick<User, 'name'>;
  responses: { 201: JsonResponse<User> };
}

export function users(app: Express): void {
  oapi.mount<GetUser>(app, {
    method: 'GET',
    path: '/users/:id',
    operationId: 'getUser',
    handler(request, response) {
      if (request.params.id === 'missing')
        return response.status(404).json({ message: 'User not found' });
      return response.json({
        id: request.params.id,
        name: `${request.query.greeting ?? 'Hello'}, Ada`,
      });
    },
  });
  oapi.mount<CreateUser>(app, {
    method: 'POST',
    path: '/users',
    operationId: 'createUser',
    handler(request, response) {
      response.setHeader('x-request-id', request.headers['x-request-id']);
      response.status(201).json({ id: 'new', name: request.body.name });
    },
  });
}
