import oapi from '@opentyped/oapi-express';
import type { Router } from '@opentyped/oapi-express';

declare const app: Router;

/**
 * @schema
 * @jsonSchema {"$id":"https://example.test/mirror","$ref":"https://child.example.test/api/openapi.json#/paths/~1model/get/responses/200/content/application~1json/schema"}
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
