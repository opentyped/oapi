import express from 'express';
import oapi from '@typedapi/express';
import type { EmptyResponse } from '@typedapi/openapi';

interface Empty {
  responses: { 204: EmptyResponse };
}
const app = express();
const router = (express.Router() satisfies express.Router)!;
const asserted = <express.Router>(router as express.Router);
const alias = (asserted satisfies express.Router)!;
app.use('/api', alias);
oapi.mount<Empty>(router, {
  method: 'GET',
  path: '/ping',
  operationId: 'ping',
  handler(_request, response) {
    response.sendStatus(204);
  },
});
const builder = (router.route('/status') as ReturnType<typeof router.route>)!;
const builderAlias = builder satisfies typeof builder;
builderAlias.get(
  oapi.handler<Empty>({
    operationId: 'status',
    handler(_request, response) {
      response.sendStatus(204);
    },
  }),
);
