/** @route QUERY /search */
export interface Search {
  body: { term: string };
  responses: { 200: { body: { found: boolean } } };
}
