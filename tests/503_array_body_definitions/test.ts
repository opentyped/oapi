import oapi from '@typedapi/express';
import type { Router } from '@typedapi/express';

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
