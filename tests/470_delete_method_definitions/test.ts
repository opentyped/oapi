import type { EmptyResponse } from '@typedapi/openapi';

/** @route DELETE /sessions */
export interface EndSession {
  responses: { 204: EmptyResponse };
}
