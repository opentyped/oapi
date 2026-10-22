import oapi from '@opentyped/oapi-express';
import type { Router } from '@opentyped/oapi-express';

declare const app: Router;
const metadata = {
  operationId: 'nestedMetadata',
  summary: 'Nested metadata',
  tags: ['group,one', 'nested'],
  docs: { url: 'https://example.com/nested', description: 'Nested reference' },
  flags: { deprecated: false },
  extensions: { 'x-owner': 'nested' },
} as const;
interface Read {
  responses: { 200: { body: { ok: true } } };
}

oapi.mount<Read>(app, {
  method: 'GET',
  path: '/nested',
  operationId: metadata.operationId,
  summary: metadata['summary'],
  description: 'First tag ' + metadata.tags[0],
  tags: metadata.tags,
  externalDocs: metadata.docs,
  deprecated: metadata.flags.deprecated,
  extensions: metadata.extensions,
  handler(_request, response) {
    response.json({ ok: true });
  },
});
