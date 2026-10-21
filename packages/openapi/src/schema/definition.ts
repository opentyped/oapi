import type { SchemaObjectValue } from 'openapi3-ts/oas32';

/** Engine-normalized schema; recursive children are inline schemas or schemas carrying $ref. */
export interface Schema extends SchemaObjectValue {
  properties?: Record<string, Schema>;
  patternProperties?: Record<string, Schema>;
  additionalProperties?: boolean | Schema;
  items?: Schema;
  prefixItems?: Schema[];
  anyOf?: Schema[];
  oneOf?: Schema[];
  allOf?: Schema[];
  [keyword: string]: unknown;
}

export type Components = Record<string, Schema>;

/** Public source declaration exported by a generated type module. */
export interface SchemaExport {
  component: string;
  module: string;
  name: string;
}
