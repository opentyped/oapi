import type { EmptyResponse } from '@opentyped/openapi';
import oapi from '@opentyped/express';
import type { Router } from '@opentyped/express';

declare const app: Router;
interface Filter {
  /** @minLength 1 */
  name: string;
  tags?: string[];
  child?: Filter;
}
interface SearchJson {
  /**
   * Complete JSON query.
   * @http {"deprecated":true,"example":{"name":"Ada"}}
   */
  querystring: { content: { 'application/json': Filter } };
  responses: { 200: { body: { ok: boolean } } };
}
interface SearchForm {
  querystring?: {
    content: {
      /** @http {"encoding":{"tags":{"style":"form","explode":true}}} */
      'application/x-www-form-urlencoded': { name?: string; tags?: string[] };
    };
  };
  responses: { 204: EmptyResponse };
}
oapi.mount<SearchJson>(app, {
  method: 'GET',
  path: '/json-query',
  operationId: 'searchJsonQuery',
  handler(request, response) {
    response.json({ ok: request.query.name.length > 0 });
  },
});
app.get(
  '/form-query',
  oapi.handler<SearchForm>({
    operationId: 'searchFormQuery',
    handler(request, response) {
      void request.query?.name;
      response.sendStatus(204);
    },
  }),
);
