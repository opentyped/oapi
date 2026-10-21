import type { operations } from './schema.js';
type Search = operations['searchPaged'];
declare const search: Search;
const term: string = search.parameters.query.term;
const page: number | undefined = search.parameters.query.page;
// @ts-expect-error Deprecated query parameters keep their declared type.
const wrong: { note: string } = search.parameters.query;
void [term, page, wrong];
