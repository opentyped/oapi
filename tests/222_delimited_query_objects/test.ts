import type { EmptyResponse } from '@opentyped/oapi-openapi';
import oapi from '@opentyped/oapi-express';
import type { Router } from '@opentyped/oapi-express';

declare const app: Router;
interface Search {
  query: {
    /** @http {"style":"spaceDelimited","explode":false} */
    color: { red: number; green: number };
    /** @http {"style":"pipeDelimited"} */
    labels?: { [name: string]: string };
  };
  responses: { 204: EmptyResponse };
}
oapi.mount<Search>(app, {
  method: 'GET',
  path: '/search',
  operationId: 'Search',
  handler(_request, response) {
    response.sendStatus(204);
  },
});
