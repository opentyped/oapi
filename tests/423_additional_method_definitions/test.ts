import type { EmptyResponse } from '@typedapi/openapi';

/** @route PURGE /items */
export interface PurgeContract {
  responses: {
    204: EmptyResponse;
    /** Fallback for unrecognized statuses. */
    default: { body: { reason: string } };
  };
}
