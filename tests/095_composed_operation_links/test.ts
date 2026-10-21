import oapi from '@typedapi/express';
import type { Router } from '@typedapi/express';

declare const app: Router;
interface Item {
  id: string;
}

/**
 * @response
 * @http {"description":"Item created","links":{"ReadById":{"operationId":"readItem","parameters":{"id":"$response.body#/id"},"description":"Read the new item"},"ReadByRef":{"operationRef":"#/paths/~1items~1%7Bid%7D/get","parameters":{"id":"$response.body#/id"}},"CreateAgain":{"operationId":"createItem","requestBody":{"operationId":"createItem","operationRef":"#/paths/~1items~1%7Bid%7D/get"},"x-purpose":"retry"}},"x-copy":{"operationId":"createItem","operationRef":"#/paths/~1items~1%7Bid%7D/get"}}
 */
interface CreatedResponse {
  body: Item;
}

interface Create {
  body: { title: string };
  responses: {
    201: CreatedResponse;
  };
}
interface Read {
  params: { id: string };
  responses: { 200: { body: Item } };
}

oapi.mount<Create>(app, {
  method: 'POST',
  path: '/items',
  operationId: 'createItem',
  handler(request, response) {
    response.status(201).json({ id: request.body.title });
  },
});
oapi.mount<Read>(app, {
  method: 'GET',
  path: '/items/:id',
  operationId: 'readItem',
  handler(request, response) {
    response.json({ id: request.params.id });
  },
});
