import oapi from '@opentyped/express';
import type { Router } from '@opentyped/express';

declare const app: Router;

interface SearchInput {
  params: { region: string };
  query: { term: string; limit?: number };
}
interface SearchOutput {
  results: string[];
}

oapi.mount<SearchInput, SearchOutput>(app, {
  method: 'GET',
  path: '/regions/:region/search',
  operationId: 'searchRegion',
  handler(request, response) {
    return response.json({ results: [request.params.region, request.query.term] });
  },
});
