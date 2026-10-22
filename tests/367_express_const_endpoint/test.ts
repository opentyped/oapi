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
const endpoints = {
  read: {
    method: 'GET',
    path: '/models/:id',
    operationId: 'readModel',
    handler(req, res) {
      res.json({ id: req.params.id });
    },
  } satisfies Endpoint<Read>,
};
const endpoint = endpoints.read;
oapi.mount<Read>(app, endpoint);
