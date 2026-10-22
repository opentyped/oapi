import express from 'express';
import oapi from '@opentyped/oapi-express';
import type { EmptyResponse } from '@opentyped/oapi-openapi';

interface ReadUser {
  params: { tenant: string; 'user-id': string; 用户: string };
  responses: { 204: EmptyResponse };
}
interface ReadItem {
  params: { 'item-id': string };
  responses: { 204: EmptyResponse };
}
const app = express();
const router = express.Router({ mergeParams: true });
app.use('/api/:tenant', router);
router.get(
  '/users/:"user-id"/:用户',
  oapi.handler<ReadUser>({
    operationId: 'readNamedUser',
    handler(request, response) {
      response
        .set(
          'X-Keys',
          [request.params.tenant, request.params['user-id'], request.params.用户].join('/'),
        )
        .sendStatus(204);
    },
  }),
);
oapi.mount<ReadItem>(app, {
  method: 'GET',
  path: '/items/:"item-id"',
  operationId: 'readNamedItem',
  handler(request, response) {
    response.set('X-Item', request.params['item-id']).sendStatus(204);
  },
});
