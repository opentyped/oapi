import oapi from '@opentyped/express';
import type { Router } from '@opentyped/express';
declare const app: Router;
interface Input {
  body: { term: string };
}
interface Output {
  results: string[];
}
oapi.mount<Input, Output>(app, {
  method: 'QUERY',
  path: '/mounted',
  operationId: 'mountedQuery',
  handler(request, response) {
    return response.json({ results: [request.body.term] });
  },
});
app.query!(
  '/wrapped',
  oapi.handler<Input, Output>({
    operationId: 'wrappedQuery',
    handler(request, response) {
      return response.json({ results: [request.body.term] });
    },
  }),
);
