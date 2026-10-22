import oapi from '@opentyped/oapi-express';
import type { Router } from '@opentyped/oapi-express';

declare const app: Router;
interface ExportFile {
  params: { id: string };
  responses: { 204: { body?: never } };
}
interface Health {
  responses: { 204: { body?: never } };
}
oapi.mount<ExportFile>(app, {
  method: 'POST',
  path: '/files/:id\\:export',
  operationId: 'exportFile',
  handler(_request, response) {
    response.status(204).end();
  },
});
app.get(
  '/\\:health',
  oapi.handler<Health>({
    operationId: 'health',
    handler(_request, response) {
      response.status(204).end();
    },
  }),
);
