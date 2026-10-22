import oapi from '@opentyped/express';
import type { EmptyResponse } from '@opentyped/openapi';
import type { Router } from '@opentyped/express';
declare const app: Router;
interface Contract {
  responses: { 204: EmptyResponse };
}
oapi.mount<Contract>(app, {
  method: 'GET',
  path: '/documented',
  operationId: 'documented',
  /**
   * Read the documented endpoint.
   *
   * Handler documentation supplies the operation details.
   * @deprecated Use the replacement endpoint.
   */
  handler(_request, response) {
    return response.status(204).end();
  },
});
oapi.mount<Contract>(app, {
  method: 'GET',
  path: '/overridden',
  operationId: 'overridden',
  summary: 'Explicit summary',
  description: 'Explicit details',
  deprecated: false,
  /**
   * Fallback summary.
   *
   * Fallback details.
   * @deprecated Older description.
   */
  handler: (_request, response) => response.status(204).end(),
});
