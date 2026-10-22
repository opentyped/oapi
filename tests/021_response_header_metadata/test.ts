import oapi from '@opentyped/express';
import type { Router } from '@opentyped/express';

declare const app: Router;
interface Read {
  responses: {
    /** @http {"headers":{"X-Trace":{"schema":{"type":"string"},"required":true,"description":"Trace identifier","deprecated":true,"style":"simple","explode":false,"example":"trace-1","x-owner":"gateway"},"X-Reason":{"content":{"text/plain":{"schema":{"type":"string"},"example":"accepted"}}}}} */
    200: { body: { ok: true } };
  };
}
oapi.mount<Read>(app, {
  method: 'GET',
  path: '/health',
  operationId: 'readHealth',
  handler(_request, response) {
    response.json({ ok: true });
  },
});
