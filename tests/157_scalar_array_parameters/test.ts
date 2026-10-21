import type { EmptyResponse } from '@typedapi/openapi';

/** @route GET /search */
export interface Search {
  query: {
    /** @http {"style":"pipeDelimited","explode":false} */
    values: string[] | readonly number[];
  };
  responses: { 204: EmptyResponse };
}
