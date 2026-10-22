import type { EmptyResponse } from '@opentyped/oapi-openapi';

/** @route GET /search */
export interface Search {
  query: {
    filter?: { [key: `item-${string}`]: string };
  };
  responses: { 204: EmptyResponse };
}
