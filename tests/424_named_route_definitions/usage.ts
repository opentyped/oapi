import type { paths, operations } from './schema.js';
type Read = operations['ReadWidget'];
declare const read: Read;
const sku: string = read.parameters.path.sku;
const widget: { sku: string; retired?: string | null } =
  read.responses[200]['content']['application/json'];
// @ts-expect-error The 404 response carries no payload.
const wrong: { sku: string } = read.responses[404]['content']['application/json'];
declare const list: paths['/widgets'];
const copyOk: undefined = list.additionalOperations.COPY.responses[207]['content'];
void [sku, widget, wrong, copyOk];
