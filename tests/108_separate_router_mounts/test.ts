import express from 'express';
import oapi from '@opentyped/express';
import type { EmptyResponse } from '@opentyped/openapi';

interface Empty {
  responses: { 204: EmptyResponse };
}
const app = express();
const router = express.Router();
app.use('/api', router);
app.use('/api/admin', router);
router.get(
  '/health',
  oapi.handler<Empty>({
    handler(_request, response) {
      response.sendStatus(204);
    },
  }),
);
