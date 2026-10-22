import oapi from '@opentyped/express';
import type { Router } from '@opentyped/express';
import { webHandler } from '@opentyped/openapi/contract';
import type { EmptyResponse } from '@opentyped/openapi/contract';

declare const app: Router;
interface Success {
  ok: true;
}
interface Contract {
  responses: {
    100: EmptyResponse;
    103: EmptyResponse;
    200: { body: Success };
  };
}

oapi.mount<Contract>(app, {
  method: 'GET',
  path: '/express/hints',
  operationId: 'expressHints',
  handler(_request, response) {
    response.writeEarlyHints({ link: '</style.css>; rel=preload; as=style' });
    response.json({ ok: true });
  },
});

/**
 * @route GET /web/hints
 * @operationId webHints
 */
export const webHints = webHandler<Contract>(() => ({ status: 200, body: { ok: true } }));
