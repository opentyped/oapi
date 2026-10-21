import oapi from '@typedapi/express';
import type { Router } from '@typedapi/express';
import type { EmptyResponse } from '@typedapi/openapi';

declare const app: Router;
const servers = [
  {
    url: 'https://{region}.example.test',
    variables: { region: { default: 'eu', enum: ['eu', 'us'] } },
  },
];
interface Ping {
  responses: { 204: EmptyResponse };
}
oapi.mount<Ping>(app, {
  method: 'GET',
  path: '/ping',
  operationId: 'ping',
  servers,
  handler(_request, response) {
    response.status(204).end();
  },
});
/** @route GET /local
 * @servers [{"url":"/local-api"}]
 */
export interface Local {
  responses: { 204: EmptyResponse };
}
