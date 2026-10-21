import type { EmptyResponse } from '@typedapi/openapi';

/** @route GET /search */
export interface Search {
  query: {
    filter?: { [key: `item-${string}`]: string };
  };
  responses: { 204: EmptyResponse };
}
