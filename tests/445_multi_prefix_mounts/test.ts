import express from 'express';
import { handler as endpoint } from '@opentyped/express';

const app = express();
const api = express.Router();
app.use(['/v1', '/v2'], api);

interface PingContract {
  responses: { 200: { body: { pong: boolean } } };
}

api.get(
  '/ping',
  endpoint<PingContract>({
    handler(_request, response) {
      response.json({ pong: true });
    },
  }),
);
