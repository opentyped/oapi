import express from 'express';
import type { RequestHandler, ErrorRequestHandler } from 'express';
import oapi from '@opentyped/oapi-express';
import type { Middleware, ExpressHandler } from '@opentyped/oapi-express';

interface Create {
  params: { id: string };
  body: { name: string };
  responses: { 201: { body: { id: string; name: string } } };
}
const app = express();
app.use(express.json());
const typed: RequestHandler<{ id: string }, { id: string; name: string }, { name: string }> = (
  request,
  response,
  next,
) => {
  response.setHeader('x-id', request.params.id);
  next(new Error('recoverable'));
};
const recover: ErrorRequestHandler<
  { id: string },
  { id: string; name: string },
  { name: string }
> = (_error, _request, response, next) => {
  response.setHeader('x-recovered', 'yes');
  next();
};
const checked: ExpressHandler<Create> = (request, response, next) => {
  response.setHeader('x-name', request.body.name);
  next();
};
const middleware = [[[typed]], recover, checked] as const satisfies readonly Middleware<Create>[];
Object.freeze(middleware[0][0]);
Object.freeze(middleware[0]);
Object.freeze(middleware);

oapi.mount<Create>(app, {
  method: 'POST',
  path: '/users/:id',
  operationId: 'createUser',
  middleware,
  handler(request, response) {
    response
      .status(201)
      .set({ 'X-Result': 'created' })
      .cookie('session', 'value', { httpOnly: true })
      .json({ id: request.params.id, name: request.body.name });
  },
});

// A plain middleware callback is contextually typed from the same contract.
oapi.mount<Create>(app, {
  method: 'POST',
  path: '/inline/:id',
  operationId: 'createInline',
  middleware: [
    (request, _response, next) => {
      const name: string = request.body.name;
      const id: string = request.params.id;
      void [name, id];
      next();
    },
  ],
  handler(request, response) {
    response.status(201).json({ id: request.params.id, name: request.body.name });
  },
});
