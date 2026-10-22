import oapi from '@opentyped/oapi-express';
import type { Router } from '@opentyped/oapi-express';

declare const app: Router;

interface FormContract {
  body: { name: string; tags?: string[] };
  responses: { 200: { body: { ok: boolean } } };
}

oapi.mount<FormContract>(app, {
  method: 'POST',
  path: '/form',
  operationId: 'submitForm',
  requestContentType: 'application/x-www-form-urlencoded',
  handler(request, response) {
    response.json({ ok: request.body.name.length > 0 });
  },
});
