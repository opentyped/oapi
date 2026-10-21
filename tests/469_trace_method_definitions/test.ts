/** @route TRACE /echo */
export interface Echo {
  responses: { 200: { body: { echoed: boolean } } };
}
