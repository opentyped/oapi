import type { EmptyResponse } from '@opentyped/openapi';

/** @route DELETE /sessions */
export interface EndSession {
  responses: { 204: EmptyResponse };
}
