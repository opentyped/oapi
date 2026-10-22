import oapi from '@opentyped/express';
import express from 'express';

const app = express();

interface User {
  id: string;
  displayName: string;
  manager?: User;
}
interface CreateBody {
  displayName: string;
  manager?: User;
}
interface Problem {
  message: string;
}
interface Create {
  params: { accountId: string };
  query: { dryRun?: boolean };
  headers: { 'X-Trace': string };
  cookies: { session?: string };
  body: CreateBody;
  responses: {
    201: { body: User; headers: { Location: string } };
    400: { body: Problem; contentType: 'application/problem+json' };
  };
}

oapi.mount<Create>(app, {
  method: 'POST',
  path: '/accounts/:accountId/users',
  operationId: 'createUser',
  summary: 'Create a user',
  tags: ['Users'],
  security: [],
  handler(request, response) {
    response.status(201).location('/users/new').json({
      id: request.params.accountId,
      displayName: request.body.displayName,
    });
  },
});

interface PreviewInput {
  params: { id: string };
  query: { prefix?: string };
}
app.get(
  '/accounts/:id/preview',
  oapi.handler<PreviewInput, User>({
    operationId: 'previewUser',
    handler(request, response) {
      response.json({ id: request.params.id, displayName: request.query.prefix ?? 'Preview' });
    },
  }),
);
