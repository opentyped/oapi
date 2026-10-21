import type { operations } from './schema.js';
type Search = operations['SearchRoute'];
declare const search: Search;
const term: string = search.parameters.query.term;
const page: number | undefined = search.parameters.query.page;
// @ts-expect-error Query parameters keep their declared types.
const wrong: { note: string } = search.parameters.query;
void [term, page, wrong];
