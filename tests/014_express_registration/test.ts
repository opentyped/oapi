import oapi from '@opentyped/oapi-express';
import type { Router } from '@opentyped/oapi-express';
import type { EmptyResponse } from '@opentyped/oapi-openapi';
declare const app: Router;
interface Model {
  id: string;
  parent?: Model;
}
interface Read {
  params: { id: string };
  query: { expand?: boolean };
  responses: { 200: { body: Model }; 404: EmptyResponse };
}
oapi.mount<Read>(app, {
  method: 'GET',
  path: '/models/:id',
  operationId: 'readModel',
  handler(req, res) {
    res.json({ id: req.params.id });
  },
});
