import type { paths, operations } from './schema.js';
type Item = paths['/things/{id}'];
declare const item: Item;
const read: { id: string } = item.get.responses[200]['content']['application/json'];
const updated: { id: string; title: string } =
  item.post.responses[200]['content']['application/json'];
declare const update: operations['updateThing'];
const title: string = update.requestBody['content']['application/json'].title;
// @ts-expect-error The path parameter is shared and required.
const empty: Item['parameters']['path'] = {};
void [read, updated, title, empty];
