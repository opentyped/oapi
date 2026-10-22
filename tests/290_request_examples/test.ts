interface Payload {
  name: string;
  next?: Payload;
}
/** @examples [{"name":"Ada"},{"name":"Grace","next":{"name":"Ada"}}] */
interface Body {
  content: {
    'application/json': Payload;
    'application/vnd.item+json': Payload;
  };
}
type AliasedBody = Body;
/**
 * @route POST /examples
 * @operationId createExamples
 */
export interface Create {
  requestBody: AliasedBody;
  responses: { 204: EmptyResponse };
}
/**
 * @route POST /override
 * @operationId overrideExamples
 */
export interface Override {
  /** @http {"example":{"name":"HTTP"}} */
  requestBody: AliasedBody;
  responses: { 204: EmptyResponse };
}
import type { EmptyResponse } from '@opentyped/oapi-openapi/contract';
