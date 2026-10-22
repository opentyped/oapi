import oapi from '@opentyped/oapi-express';
import type { Router } from '@opentyped/oapi-express';

declare const app: Router;

interface RowInput {
  body: { cells: string[] }[];
}
interface RowOutput {
  saved: number;
}

oapi.mount<RowInput, RowOutput>(app, {
  method: 'POST',
  path: '/rows',
  operationId: 'createRows',
  handler(request, response) {
    return response.json({ saved: request.body.length });
  },
});
