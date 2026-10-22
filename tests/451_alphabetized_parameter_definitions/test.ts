import oapi from '@opentyped/oapi-express';
import type { Router } from '@opentyped/oapi-express';

declare const app: Router;

interface SearchInput {
  query: {
    zebra: string;
    alpha: string;
    middle: string;
  };
  responses: { 200: { body: { ok: boolean } } };
}

oapi.mount<SearchInput>(app, {
  method: 'GET',
  path: '/sorted',
  operationId: 'searchSorted',
  handler(request, response) {
    return response.json({ ok: request.query.zebra.length > 0 });
  },
});
