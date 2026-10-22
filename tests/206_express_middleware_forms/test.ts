import oapi from '@opentyped/oapi-express';
import type { Router, Middleware } from '@opentyped/oapi-express';
import type { RequestHandler, ErrorRequestHandler } from 'express';

declare const app: Router;
const mark: RequestHandler = (_request, response, next) => {
  response.setHeader('x-before', 'yes');
  next(new Error('recoverable'));
};
const recover: ErrorRequestHandler = (_error, _request, response, next) => {
  response.setHeader('x-recovered', 'yes');
  next();
};
const middleware: readonly Middleware[] = [[mark], recover];
interface Read {
  responses: { 200: { body: { ok: boolean } } };
}
oapi.mount<Read>(app, {
  method: 'GET',
  path: '/middleware',
  operationId: 'middleware',
  middleware,
  handler(_request, response) {
    response.json({ ok: true });
  },
});
