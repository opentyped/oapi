import type { EmptyResponse } from '@opentyped/openapi';
import oapi from '@opentyped/express';
import type { Router } from '@opentyped/express';

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
