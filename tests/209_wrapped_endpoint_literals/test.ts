import oapi from '@opentyped/express';
import type { Router, Endpoint, Handler } from '@opentyped/express';

declare const app: Router;
interface Read {
  responses: { 200: { body: { ok: boolean } } };
}
oapi.mount<Read>(app, {
  method: 'GET',
  path: '/satisfies',
  operationId: 'satisfiesEndpoint',
  handler(_request, response) {
    response.json({ ok: true });
  },
} satisfies Endpoint<Read>);
app.get(
  '/asserted',
  oapi.handler<Read>(
    ({
      operationId: 'assertedHandler',
      handler(_request, response) {
        response.json({ ok: true });
      },
    } as Handler<Read>)!,
  ),
);
