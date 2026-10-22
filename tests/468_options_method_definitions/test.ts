import type { EmptyResponse } from '@opentyped/openapi';

/** @route OPTIONS /preflight */
export interface Preflight {
  responses: { 204: EmptyResponse };
}
