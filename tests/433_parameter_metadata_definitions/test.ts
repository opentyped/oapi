import oapi from '@opentyped/oapi-express';
import type { Router } from '@opentyped/oapi-express';

declare const app: Router;

interface SearchInput {
  query: {
    /** Search term. */
    term: string;
    /**
     * Result page.
     * @deprecated
     * @example 2
     */
    page?: number;
  };
  responses: { 200: { body: { results: string[] } } };
}

oapi.mount<SearchInput>(app, {
  method: 'GET',
  path: '/search',
  operationId: 'searchPaged',
  handler(request, response) {
    return response.json({ results: [request.query.term] });
  },
});
