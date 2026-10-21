import oapi from '@typedapi/express';
import type { Router } from '@typedapi/express';

declare const app: Router;

interface Filter {
  /** @minLength 1 */
  name: string;
  tags?: string[];
}
interface SearchJson {
  /**
   * Complete JSON query.
   * @http {"deprecated": true}
   */
  querystring: { content: { 'application/json': Filter } };
  responses: { 200: { body: { ok: boolean } } };
}

oapi.mount<SearchJson>(app, {
  method: 'GET',
  path: '/search',
  operationId: 'searchJson',
  handler(_request, response) {
    response.json({ ok: true });
  },
});
