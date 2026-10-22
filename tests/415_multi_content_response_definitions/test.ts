import oapi from '@opentyped/oapi-express';
import type { Router } from '@opentyped/oapi-express';

declare const app: Router;

interface JsonPayload {
  id: string;
}
interface TextPayload {
  note: string;
}

/**
 * Negotiated payload.
 * @response
 */
interface NegotiatedResponse {
  content: {
    'application/json': JsonPayload;
    'text/plain': TextPayload;
  };
}

interface Read {
  params: { id: string };
  responses: { 200: NegotiatedResponse };
}

oapi.mount<Read>(app, {
  method: 'GET',
  path: '/negotiated/:id',
  operationId: 'readNegotiated',
  handler(request, response) {
    response.json({ id: request.params.id });
  },
});
