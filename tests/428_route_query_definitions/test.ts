/** @route GET /search */
export interface SearchRoute {
  query: { term: string; page?: number };
  responses: { 200: { body: { results: string[] } } };
}
