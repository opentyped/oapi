/**
 * @route GET /source
 * @operationId source
 */
export interface Source {
  responses: {
    /** @http {"examples":{"linkTarget":{"value":{"operationId":"readItems"}}},"links":{"Read":{"$ref":"#/paths/~1source/get/responses/200/content/application~1json/examples/linkTarget/value"}}} */
    200: { body: { operationId: string } };
  };
}

/**
 * @route GET /items
 * @operationId readItems
 */
export interface ReadItems {
  responses: { 204: { body?: never } };
}
