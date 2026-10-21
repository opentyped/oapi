import type { EmptyResponse } from '@typedapi/openapi';

interface UserPayload {
  id: string;
}

/** @webhook POST user/created */
export interface UserCreated {
  body: UserPayload;
  responses: { 204: EmptyResponse };
}

/** @webhook POST user/deleted */
export interface UserDeleted {
  body: { id: string; reason?: string };
  responses: { 204: EmptyResponse };
}
