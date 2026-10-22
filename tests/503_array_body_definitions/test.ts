import oapi from '@opentyped/express';
import type { Router } from '@opentyped/express';

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
