import express from 'express';
import oapi from '@typedapi/express';
import type { EmptyResponse } from '@typedapi/openapi';

interface ReadUser {
  params: { tenant: string; region: string; 'user-id': string; 用户: string };
  responses: { 204: EmptyResponse };
}
interface ReadItem {
  params: { 'item-id': string };
  responses: { 204: EmptyResponse };
}
const app = express();
const router = express.Router({ mergeParams: true });
const regions = express.Router({ mergeParams: true });
app.use('/api/:tenant', regions);
regions.use('/regions/:region', router);
router.get(
  '/users/:"user-id"/:用户',
  oapi.handler<ReadUser>({
    operationId: 'readNamedUser',
    handler(request, response) {
      response
        .set(
          'X-Keys',
          [
            request.params.tenant,
            request.params.region,
            request.params['user-id'],
            request.params.用户,
          ]
            .map(encodeURIComponent)
            .join('/'),
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
    response.set('X-Item', encodeURIComponent(request.params['item-id'])).sendStatus(204);
  },
});
