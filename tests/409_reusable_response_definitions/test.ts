import oapi from '@opentyped/oapi-express';
import type { Router } from '@opentyped/oapi-express';

declare const app: Router;

interface ItemPayload {
  id: string;
}
interface ProblemPayload {
  message: string;
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

/** The item was not found. */
type MissingResponse = ProblemResponse;

interface Read {
  params: { id: string };
  responses: { 200: ItemResponse; 404: MissingResponse };
}

oapi.mount<Read>(app, {
  method: 'GET',
  path: '/items/:id',
  operationId: 'readItem',
  handler(request, response) {
    response.set('X-Request-Id', 'read-1').json({ id: request.params.id });
  },
});
