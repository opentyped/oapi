import type { operations } from './schema.js';
type Search = operations['searchSorted'];
declare const search: Search;
const alpha: string = search.parameters.query.alpha;
const zebra: string = search.parameters.query.zebra;
// @ts-expect-error Alphabetized parameters keep their declared types.
const wrong: { note: string } = search.parameters.query;
void [alpha, zebra, wrong];
