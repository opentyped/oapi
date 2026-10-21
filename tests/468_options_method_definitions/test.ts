import type { EmptyResponse } from '@typedapi/openapi';

/** @route OPTIONS /preflight */
export interface Preflight {
  responses: { 204: EmptyResponse };
}
