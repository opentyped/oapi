import express from 'express';
import oapi from '@opentyped/oapi-express';
import type { Handler } from '@opentyped/oapi-express';
import type { EmptyResponse } from '@opentyped/oapi-openapi';
const app = express();
interface Model {
  id: string;
  parent?: Model;
}
interface Read {
  params: { id: string };
  query: { expand?: boolean };
  responses: { 200: { body: Model }; 404: EmptyResponse };
}
const definition: Handler<Read> = {
  operationId: 'readModel',
  handler(req, res) {
    res.json({ id: req.params.id });
  },
};
app.get('/models/:id', oapi.handler<Read>(definition));
