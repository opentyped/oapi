import oapi from '@opentyped/express';
import type { HttpInput } from '@opentyped/openapi';
import type { Router } from '@opentyped/express';
declare const app: Router;
type Input = Pick<HttpInput, never>;
interface Output {
  name: string;
}
oapi.mount<Input, Output>(app, {
  method: 'PROPFIND',
  path: '/files',
  operationId: 'inspect',
  handler(_request, response) {
    return response.json({ name: 'file' });
  },
});
app['m-search']!(
  '/search',
  oapi.handler<Input, Output>({
    operationId: 'search',
    handler(_request, response) {
      return response.json({ name: 'found' });
    },
  }),
);
