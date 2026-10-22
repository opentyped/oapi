import oapi from '@opentyped/oapi-express';
import type { Router } from '@opentyped/oapi-express';
import { webHandler } from '@opentyped/oapi-openapi/contract';

declare const app: Router;
interface Success {
  ok: true;
}
interface Failure {
  message: string;
  previous?: Failure;
}
interface Contract {
  responses: {
    200: { body: Success };
    '2XX': { body: string; contentType: 'text/plain' };
    default: { body: Failure };
  };
}

oapi.mount<Contract>(app, {
  method: 'GET',
  path: '/express/ranged',
  operationId: 'expressRange',
  handler(_request, response) {
    response.status(201).set('X-Result', 'created').send('Created');
  },
});

/**
 * @route GET /web/ranged
 * @operationId webRange
 */
export const webRange = webHandler<Contract>(() => ({
  status: 418,
  body: { message: 'Choose another representation' },
}));
