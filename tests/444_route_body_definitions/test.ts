/** @route POST /reports */
export interface GenerateReport {
  body: { from: string; to: string };
  responses: { 202: { body: { job: string } } };
}
