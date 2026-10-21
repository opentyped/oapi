/** @schema */
export interface Search {
  id: string;
  cursor?: string;
}

/** @schema @jsonSchema {"$ref":"#/components/schemas/Search","required":["cursor"]} */
export type RequiredSearch = unknown;

/** @route GET /search @operationId search */
export interface ReadSearch {
  query: RequiredSearch;
  responses: { 200: { body: string } };
}
