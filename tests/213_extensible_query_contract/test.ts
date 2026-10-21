import oapi from '@typedapi/express';
import type { Router, Handler } from '@typedapi/express';

declare const app: Router;
interface Read {
  query: { name: string };
  responses: { 200: { body: { ok: boolean } } };
}
interface ExtensibleRead extends Read {
  [key: string]: unknown;
}
const shared: Handler<ExtensibleRead> = {
  handler(request, response) {
    response.json({ ok: request.query.name.length > 0 });
  },
};
oapi.mount<Read>(app, {
  method: 'GET',
  path: '/ordinary-query',
  operationId: 'ordinaryQuery',
  handler: shared.handler,
});
