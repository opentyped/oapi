import oapi from '@opentyped/oapi-express';
import type { Router } from '@opentyped/oapi-express';

declare const app: Router;
interface Read {
  responses: { 200: { body: { ok: boolean } } };
}
// prettier-ignore
app.get('/trailing', oapi.handler<Read>(
  {
    operationId: 'trailingComma',
    handler(_request, response) {
      response.json({ ok: true });
    },
  } /* before comma */, /* after comma */
));
