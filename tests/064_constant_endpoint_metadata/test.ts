import oapi from '@opentyped/express';
import type { Router } from '@opentyped/express';

declare const app: Router;
const tags = ['group,one', 'status'] as const;
const security = [] as const;
const deprecated = true;
const current = false;
const operationId = 'statusInfo';
const docsBase = 'https://example.com';
enum Label {
  Reference = 'Status reference',
}
const externalDocs = { url: `${docsBase}/status`, description: Label.Reference };
const extensions = { 'x-owner': 'plat' + 'form' };

interface Read {
  responses: { 200: { body: { ok: true } } };
}

oapi.mount<Read>(app, {
  method: 'GET',
  path: '/status',
  operationId,
  tags,
  security,
  deprecated,
  externalDocs,
  extensions,
  handler(_request, response) {
    response.json({ ok: true });
  },
});

app.get(
  '/status/current',
  oapi.handler<Read>({
    operationId: 'currentStatus',
    deprecated: current,
    tags: [] as const,
    handler(_request, response) {
      response.json({ ok: true });
    },
  }),
);
