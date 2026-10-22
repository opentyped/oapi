import oapi from '@opentyped/oapi-express';
import type { Router } from '@opentyped/oapi-express';

declare const app: Router;

interface ListInput {
  query: { prefix?: string };
}
type ListOutput = string[];

oapi.mount<ListInput, ListOutput>(app, {
  method: 'GET',
  path: '/tags',
  operationId: 'listTags',
  handler(_request, response) {
    return response.json(['a', 'b']);
  },
});
