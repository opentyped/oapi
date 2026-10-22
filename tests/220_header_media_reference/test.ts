import type { EmptyResponse } from '@opentyped/openapi';

/** @route GET /read */
export interface Read {
  responses: {
    /** @http {"headers":{"X-Data":{"$ref":"#/components/headers/Data"}}} */
    204: EmptyResponse;
  };
}
