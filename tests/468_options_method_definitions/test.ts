import type { EmptyResponse } from '@opentyped/oapi-openapi';

/** @route OPTIONS /preflight */
export interface Preflight {
  responses: { 204: EmptyResponse };
}
