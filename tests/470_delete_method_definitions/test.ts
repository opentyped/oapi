import type { EmptyResponse } from '@opentyped/oapi-openapi';

/** @route DELETE /sessions */
export interface EndSession {
  responses: { 204: EmptyResponse };
}
