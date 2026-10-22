import express from 'express';
import oapi from '@opentyped/express';
import type { EmptyResponse } from '@opentyped/openapi';

interface Empty {
  responses: { 204: EmptyResponse };
}
const app = express();
const router = express.Router();
const routers = { router };
const nested = { api: { selected: routers.router } };
const list = [nested.api.selected] as const;
const selected = list[0];
app.use('/api', selected);
oapi.mount<Empty>(router, {
  method: 'GET',
  path: '/ping',
  operationId: 'ping',
  handler(_request, response) {
    response.sendStatus(204);
  },
});
const status = router.route('/status');
const builders = { status };
const routes = [builders.status] as const;
routes[0].get(
  oapi.handler<Empty>({
    operationId: 'status',
    handler(_request, response) {
      response.sendStatus(204);
    },
  }),
);
