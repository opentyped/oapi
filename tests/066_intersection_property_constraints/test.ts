import oapi from '@opentyped/oapi-express';
import type { Router } from '@opentyped/oapi-express';
import type { EmptyResponse } from '@opentyped/oapi-openapi';

declare const app: Router;
interface Left {
  /** @http {"description":"Shared query value","style":"form"} */
  shared: string | number;
  left: boolean;
  list: (string | number)[];
}
interface Right {
  shared: number;
  right: string;
  list: number[];
}

/** @schema */
export type Model = Left & Right;

interface Search {
  query: Left & Right;
  responses: { 204: EmptyResponse };
}
oapi.mount<Search>(app, {
  method: 'GET',
  path: '/overlap',
  operationId: 'overlapSearch',
  handler(_request, response) {
    response.status(204).end();
  },
});
