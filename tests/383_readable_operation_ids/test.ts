import express from 'express';
import oapi from '@opentyped/oapi-express';
import type { EmptyResponse } from '@opentyped/oapi-openapi';

interface Empty {
  responses: { 204: EmptyResponse };
}
interface Post extends Empty {
  params: { userId: string; postId: string };
}
interface Named extends Empty {
  params: { 名: string };
}
const app = express();
oapi.mount<Empty>(app, {
  method: 'GET',
  path: '/',
  handler(_request, response) {
    response.sendStatus(204);
  },
});
oapi.mount<Post>(app, {
  method: 'GET',
  path: '/v1/users/:userId/posts/:postId',
  handler(_request, response) {
    response.sendStatus(204);
  },
});
oapi.mount<Named>(app, {
  method: 'GET',
  path: '/users/:名',
  handler(_request, response) {
    response.sendStatus(204);
  },
});
oapi.mount<Empty>(app, {
  method: 'GET',
  path: '/health-check',
  handler(_request, response) {
    response.sendStatus(204);
  },
});
oapi.mount<Empty>(app, {
  method: 'M-SEARCH',
  path: '/devices',
  handler(_request, response) {
    response.sendStatus(204);
  },
});
oapi.mount<Empty>(app, {
  method: 'POST',
  path: '/explicit',
  operationId: 'stablePublicMethod',
  handler(_request, response) {
    response.sendStatus(204);
  },
});
