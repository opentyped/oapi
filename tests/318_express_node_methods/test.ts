import oapi from '@typedapi/express';
import type { HttpInput } from '@typedapi/openapi';
import type { Router } from '@typedapi/express';
declare const app: Router;
type Input = Pick<HttpInput, never>;
interface Output {
  name: string;
}
oapi.mount<Input, Output>(app, {
  method: 'BIND',
  path: '/files',
  operationId: 'inspect',
  handler(_request, response) {
    return response.json({ name: 'file' });
  },
});
app['source']!(
  '/search',
  oapi.handler<Input, Output>({
    operationId: 'search',
    handler(_request, response) {
      return response.json({ name: 'found' });
    },
  }),
);
