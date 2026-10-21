import type { operations } from './schema.js';
type Search = operations['searchRegion'];
declare const search: Search;
const region: string = search.parameters.path.region;
const term: string = search.parameters.query.term;
const limit: number | undefined = search.parameters.query.limit;
// @ts-expect-error Path and query locations are distinct.
const wrong: string = search.parameters.query.region;
void [region, term, limit, wrong];
