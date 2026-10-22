import type { EmptyResponse } from '@opentyped/openapi';

/** @route PURGE /items */
export interface PurgeContract {
  responses: {
    204: EmptyResponse;
    /** Fallback for unrecognized statuses. */
    default: { body: { reason: string } };
  };
}
