import type { components, operations } from './schema.js';
type Search = operations['searchJson'];
declare const search: Search;
const filter: components['schemas']['Filter'] = search.parameters.querystring.query;
// @ts-expect-error The whole-query parameter is required.
const absent: Search['parameters']['querystring'] = { query: undefined };
void [filter, absent];
