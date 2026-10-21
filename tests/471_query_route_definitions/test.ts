/** @route QUERY /reports */
export interface QueryReport {
  query: { period: string };
  responses: { 200: { body: { total: number } } };
}
