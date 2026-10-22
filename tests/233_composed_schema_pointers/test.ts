import oapi from '@opentyped/express';
import type { Router } from '@opentyped/express';

declare const app: Router;

/**
 * @schema
 * @jsonSchema {"$id":"https://example.test/mirror","$ref":"https://example.test/openapi.json#/paths/~1model/get/responses/200/content/application~1json/schema"}
 */
export type Mirror = unknown;

interface Contract {
  responses: { 200: { body: string } };
}
oapi.mount<Contract>(app, {
  method: 'GET',
  path: '/model',
  operationId: 'model',
  handler(_request, response) {
    response.json('model');
  },
});
