import type { EmptyResponse } from '@opentyped/openapi';

/** @route GET /search */
export interface Search {
  query: {
    filter?: { [key: `item-${string}`]: string };
  };
  responses: { 204: EmptyResponse };
}
