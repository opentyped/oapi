import oapi from '@opentyped/oapi-express';
import type { Handler, Router } from '@opentyped/oapi-express';
import type { EmptyResponse } from '@opentyped/oapi-openapi';
declare const app: Router;
interface Contract {
  responses: { 204: EmptyResponse };
}
type Arguments = Parameters<Handler<Contract>['handler']>;
const handlers = {
  /**
   * Read through an indexed method.
   *
   * Method documentation survives bracket access.
   * @deprecated Use the arrow handler.
   */
  read(...[, response]: Arguments) {
    return response.status(204).end();
  },
  /**
   * Read through an indexed arrow.
   *
   * Arrow documentation belongs to its object property.
   */
  arrow: (...[, response]: Arguments) => response.status(204).end(),
};
const key = 'arrow';
oapi.mount<Contract>(app, {
  method: 'GET',
  path: '/method',
  operationId: 'method',
  handler: handlers['read'],
});
oapi.mount<Contract>(app, {
  method: 'GET',
  path: '/arrow',
  operationId: 'arrow',
  handler: handlers[key],
});
oapi.mount<Contract>(app, {
  method: 'GET',
  path: '/override',
  operationId: 'override',
  summary: 'Explicit summary',
  description: 'Explicit details',
  deprecated: false,
  handler: handlers['read'],
});
