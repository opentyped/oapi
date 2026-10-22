import type { EmptyResponse } from '@opentyped/oapi-openapi';

/** @route GET /preferences */
export interface Preferences {
  cookies: {
    /** @http {"style":"cookie"} */
    session: string;
    /** @http {"style":"cookie","explode":true} */
    colors?: string[];
    /** @http {"style":"cookie","explode":true} */
    settings?: { theme: string; compact: boolean };
  };
  responses: { 204: EmptyResponse };
}
