import express from 'express';
import oapi from '@opentyped/oapi-express';
import type { EmptyResponse } from '@opentyped/oapi-openapi';

interface Empty {
  responses: { 204: EmptyResponse };
}
const app = express();
const router = express.Router();
const prefixes = ['/api', '/internal'];
const routers = [router];
const mounted = [...routers];
app.use(prefixes, mounted);
const paths = ['/alpha', '/beta'];
router.get(
  paths,
  oapi.handler<Empty>({
    handler(_request, response) {
      response.sendStatus(204);
    },
  }),
);
const routes = router.route(['/gamma', '/delta']);
routes.post(
  oapi.handler<Empty>({
    handler(_request, response) {
      response.sendStatus(204);
    },
  }),
);
