/** @route GET /rates */
export interface ReadRates {
  responses: {
    '2XX': { body: { value: number } };
    default: { body: { reason: string } };
  };
}
