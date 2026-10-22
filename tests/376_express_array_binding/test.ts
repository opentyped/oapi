import express from 'express';
import oapi from '@opentyped/oapi-express';
import type { Endpoint } from '@opentyped/oapi-express';
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
const route = ['GET', '/models/:id'] as const;
const [method, path] = route;
const endpoints = [
  {
    method,
    path,
    operationId: 'readModel',
    handler(req, res) {
      res.json({ id: req.params.id });
    },
  } satisfies Endpoint<Read>,
] as const;
const [endpoint] = endpoints;
oapi.mount<Read>(app, endpoint);
