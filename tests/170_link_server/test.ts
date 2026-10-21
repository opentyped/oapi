/** @route GET /item */
export interface Read {
  responses: {
    /** @http {"links":{"Again":{"operationId":"Read","server":{"url":"https://{region}.example.test/{version}","description":"Regional API","variables":{"region":{"default":"west","enum":["west","east"]},"version":{"default":"v1"}}}}}} */
    200: { body: string };
  };
}
