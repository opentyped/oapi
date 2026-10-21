/** @route GET /legacy */
export interface LegacyReport {
  /** @deprecated */
  responses: { 200: { body: { total: number } } };
}
