import oapi from '@opentyped/oapi-express';
import type { Router } from '@opentyped/oapi-express';
import type { EmptyResponse } from '@opentyped/oapi-openapi';

declare const app: Router;
interface Draft {
  title: string;
  previous?: Draft;
}
interface Save {
  /** @http {"description":"An optional draft","x-purpose":"autosave"} */
  requestBody?: {
    content: {
      /** @http {"example":{"title":"Untitled"}} */
      'application/json': Draft;
      /** @http {"example":"Untitled"} */
      'text/plain': string;
    };
  };
  responses: { 204: EmptyResponse };
}

oapi.mount<Save>(app, {
  method: 'POST',
  path: '/drafts',
  operationId: 'saveDraft',
  handler(request, response) {
    const title =
      typeof request.body === 'string' ? request.body : (request.body?.title ?? 'Untitled');
    response.setHeader('X-Draft-Title', title);
    response.status(204).end();
  },
});
