/**
 * @title Annotated point
 * @description Serialized point coordinates.
 * @default {"kind":"point","coordinates":[0,0]}
 * @examples [{"kind":"point","coordinates":[1,2]}]
 * @deprecated true
 * @xml {"name":"point"}
 * @jsonSchema {"title":"Wire point","type":"object","properties":{"kind":{"const":"point"},"coordinates":{"type":"array","prefixItems":[{"type":"number"},{"type":"number"}],"items":false,"minItems":2}},"required":["kind","coordinates"],"additionalProperties":false}
 */
type Point = unknown;

/** @schema */
export interface Model {
  point: Point;
  /**
   * @title Forbidden payload
   * @deprecated true
   * @jsonSchema false
   */
  forbidden?: unknown;
  /**
   * @title Labels
   * @writeOnly true
   * @jsonSchema {"type":"object","patternProperties":{"^x-":{"type":"string"}},"additionalProperties":false}
   */
  labels: unknown;
}
