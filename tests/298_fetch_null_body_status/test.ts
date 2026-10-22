import oapi from '@opentyped/express';
import type { Router } from '@opentyped/express';
import { webHandler } from '@opentyped/openapi/contract';
import type { EmptyResponse } from '@opentyped/openapi/contract';

declare const app: Router;
interface Payload {
  ok: true;
  previous?: Payload;
}
interface Contract {
  responses: {
    '2XX': { body: Payload };
    204: EmptyResponse;
    205: EmptyResponse;
    '3XX': { body: Payload };
    304: EmptyResponse;
    default: { body: Payload };
  };
}

oapi.mount<Contract>(app, {
  method: 'GET',
  path: '/express/empty',
  operationId: 'expressEmpty',
  handler(_request, response) {
    response.status(205).end();
  },
});

/**
 * @route GET /web/empty
 * @operationId webEmpty
 */
export const webEmpty = webHandler<Contract>(() => ({ status: 204 }));

export const inferred = webHandler(() => ({ status: 200, body: { ok: true } }));
