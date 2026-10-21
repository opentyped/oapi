import oapi from '@typedapi/express';
import type { Router } from '@typedapi/express';

declare const app: Router;
interface ItemPayload {
  id: string;
  parent?: ItemPayload;
}
interface ProblemPayload {
  message: string;
}
interface CreateBody {
  title: string;
}

/**
 * An item was returned.
 * @response
 */
interface ItemResponse {
  body: ItemPayload;
  headers: { 'X-Request-Id': string };
}

/**
 * A problem response.
 * @response
 */
interface ProblemResponse {
  body: ProblemPayload;
  contentType: 'application/problem+json';
}

/** @http {"description":"Validation failed"} */
type ValidationResponse = ProblemResponse;
type ForwardedValidation = ValidationResponse;

/** The item was not found. */
type MissingResponse = ProblemResponse;

/** @example {"message":"Request rejected"} */
type ExampleResponse = ProblemResponse;

interface Read {
  params: { id: string };
  responses: { 200: ItemResponse; 404: MissingResponse };
}
interface Create {
  body: CreateBody;
  responses: { 201: ItemResponse; 400: ForwardedValidation; '4XX': ExampleResponse };
}

oapi.mount<Read>(app, {
  method: 'GET',
  path: '/items/:id',
  operationId: 'readItem',
  handler(request, response) {
    response.set('X-Request-Id', 'read-1').json({ id: request.params.id });
  },
});

oapi.mount<Create>(app, {
  method: 'POST',
  path: '/items',
  operationId: 'createItem',
  handler(request, response) {
    if (!request.body.title) return response.status(400).json({ message: 'Missing title' });
    response.status(201).set('X-Request-Id', 'create-1').json({ id: request.body.title });
  },
});
