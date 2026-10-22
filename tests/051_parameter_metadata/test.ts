import oapi from '@opentyped/express';
import type { Router } from '@opentyped/express';
import type { EmptyResponse } from '@opentyped/openapi';

declare const app: Router;

interface Search {
  params: {
    /** @http {"description":"Catalog identifier","example":"main"} */
    catalog: string;
  };
  query: {
    /** @http {"style":"pipeDelimited","explode":false,"allowReserved":true,"example":["new","sale"],"x-owner":"search"} */
    tags?: string[];
    /** @http {"description":"Flat search filters"} */
    filter?: { name?: string; available?: boolean };
  };
  headers: {
    /** @http {"deprecated":true,"style":"simple","explode":false,"example":"trace-1"} */
    'X-Trace'?: string;
  };
  cookies: {
    /** @http {"style":"form","explode":false,"examples":{"primary":{"value":"session-1"}}} */
    session: string;
  };
  responses: {
    /** Search completed. */
    204: EmptyResponse;
  };
}

oapi.mount<Search>(app, {
  method: 'GET',
  path: '/catalogs/:catalog/search',
  operationId: 'searchCatalog',
  handler(_request, response) {
    response.status(204).end();
  },
});
