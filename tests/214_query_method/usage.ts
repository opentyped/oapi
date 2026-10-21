import type { paths, operations } from './schema.js';

type Query = paths['/search']['query'];
const body: Query['requestBody']['content']['application/json'] = { term: 'Ada' };
const response: operations['Search']['responses'][200]['content']['application/json'] = {
  found: true,
};
// @ts-expect-error The QUERY body has a required term.
const missing: Query['requestBody']['content']['application/json'] = {};
// @ts-expect-error The response field remains boolean.
const incorrect: typeof response = { found: 'yes' };
void [body, response, missing, incorrect];
