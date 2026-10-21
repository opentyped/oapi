/**
 * OpenAPI 3.2 document model.
 *
 * These types describe documents as they appear after JSON parsing: permissive
 * where the spec allows latitude, strict where the generator relies on a shape.
 * They are internal to definition generation, not a public document API.
 *
 * @see https://spec.openapis.org/oas/v3.2.0
 */

/** Specification extensions (`x-` keys) may carry any JSON value. */
export interface Extensions {
  [key: `x-${string}`]: unknown;
}

export interface Document extends Extensions {
  /** Canonical URI of the document, assigned during compilation. */
  $self?: string;
  /** REQUIRED. The OpenAPI version this document uses. */
  openapi: string;
  info: InfoObject;
  jsonSchemaDialect?: string;
  servers?: ServerObject[];
  paths?: PathsObject;
  webhooks?: Record<string, PathItemObject | ReferenceObject>;
  components?: ComponentsObject;
  security?: SecurityRequirementObject[];
  tags?: TagObject[];
  externalDocs?: ExternalDocumentationObject;
  $defs?: Record<string, SchemaObject>;
}

export interface InfoObject extends Extensions {
  title: string;
  summary?: string;
  description?: string;
  termsOfService?: string;
  contact?: ContactObject;
  license?: LicenseObject;
  version: string;
}

export interface ContactObject extends Extensions {
  name?: string;
  url?: string;
  email?: string;
}

export interface LicenseObject extends Extensions {
  name: string;
  /** Mutually exclusive with `url`. */
  identifier?: string;
  url?: string;
}

export interface ServerObject extends Extensions {
  url: string;
  description?: string;
  variables?: Record<string, ServerVariableObject>;
}

export interface ServerVariableObject extends Extensions {
  enum?: string[];
  default: string;
  description?: string;
}

export interface ComponentsObject extends Extensions {
  mediaTypes?: Record<string, MediaTypeObject | ReferenceObject>;
  schemas?: Record<string, SchemaObject>;
  responses?: Record<string, ResponseObject | ReferenceObject>;
  parameters?: Record<string, ParameterObject | ReferenceObject>;
  examples?: Record<string, ExampleObject | ReferenceObject>;
  requestBodies?: Record<string, RequestBodyObject | ReferenceObject>;
  headers?: Record<string, HeaderObject | ReferenceObject>;
  securitySchemes?: Record<string, SecuritySchemeObject | ReferenceObject>;
  links?: Record<string, LinkObject | ReferenceObject>;
  callbacks?: Record<string, CallbackObject | ReferenceObject>;
  pathItems?: Record<string, PathItemObject | ReferenceObject>;
}

export interface PathsObject {
  [pathname: string]: PathItemObject | ReferenceObject;
}

/** OpenAPI 3.2 query operations, keyed by name. */
export interface WebhooksObject {
  [name: string]: PathItemObject;
}

export interface PathItemObject extends Extensions {
  /** OpenAPI 3.2 query operation. */
  query?: OperationObject | ReferenceObject;
  /** OpenAPI 3.2 operations beyond the standard HTTP methods. */
  additionalOperations?: Record<string, OperationObject | ReferenceObject>;
  get?: OperationObject | ReferenceObject;
  put?: OperationObject | ReferenceObject;
  post?: OperationObject | ReferenceObject;
  delete?: OperationObject | ReferenceObject;
  options?: OperationObject | ReferenceObject;
  head?: OperationObject | ReferenceObject;
  patch?: OperationObject | ReferenceObject;
  trace?: OperationObject | ReferenceObject;
  servers?: ServerObject[];
  parameters?: (ParameterObject | ReferenceObject)[];
}

export interface OperationObject extends Extensions {
  tags?: string[];
  summary?: string;
  description?: string;
  externalDocs?: ExternalDocumentationObject;
  operationId?: string;
  parameters?: (ParameterObject | ReferenceObject)[];
  requestBody?: RequestBodyObject | ReferenceObject;
  responses?: ResponsesObject;
  callbacks?: Record<string, CallbackObject | ReferenceObject>;
  deprecated?: boolean;
  security?: SecurityRequirementObject[];
  servers?: ServerObject[];
}

export interface ExternalDocumentationObject extends Extensions {
  description?: string;
  url: string;
}

export interface ParameterObject extends Extensions {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie' | 'querystring';
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  allowEmptyValue?: boolean;
  style?: string;
  explode?: boolean;
  allowReserved?: boolean;
  schema?: SchemaObject;
  example?: unknown;
  examples?: Record<string, ExampleObject | ReferenceObject>;
  content?: Record<string, MediaTypeObject | ReferenceObject>;
}

export interface RequestBodyObject extends Extensions {
  description?: string;
  content: Record<string, MediaTypeObject | ReferenceObject>;
  required?: boolean;
}

export interface MediaTypeObject extends Extensions {
  /** OpenAPI 3.2: schema of each framed item, distinct from the aggregate `schema`. */
  itemSchema?: SchemaObject | ReferenceObject;
  schema?: SchemaObject | ReferenceObject;
  example?: unknown;
  examples?: Record<string, ExampleObject | ReferenceObject>;
  encoding?: Record<string, EncodingObject>;
}

export interface EncodingObject extends Extensions {
  contentType?: string;
  headers?: Record<string, HeaderObject | ReferenceObject>;
  style?: string;
  explode?: string;
  allowReserved?: string;
}

export type ResponsesObject = Record<string, ResponseObject | ReferenceObject> & {
  default?: ResponseObject | ReferenceObject;
};

export interface ResponseObject extends Extensions {
  description: string;
  headers?: Record<string, HeaderObject | ReferenceObject>;
  content?: Record<string, MediaTypeObject>;
  links?: Record<string, LinkObject | ReferenceObject>;
}

export type CallbackObject = Record<string, PathItemObject>;

export interface ExampleObject extends Extensions {
  summary?: string;
  description?: string;
  value?: unknown;
  externalValue?: string;
}

export interface LinkObject extends Extensions {
  operationRef?: string;
  operationId?: string;
  parameters?: Record<string, `$${string}`>;
  requestBody?: `$${string}`;
  description?: string;
  server?: ServerObject;
}

/** The Header Object follows the Parameter Object without `name` and `in`. */
export type HeaderObject = Omit<ParameterObject, 'name' | 'in'>;

export interface TagObject extends Extensions {
  name: string;
  description?: string;
  externalDocs?: ExternalDocumentationObject;
}

export interface ReferenceObject extends Extensions {
  $ref: string;
  summary?: string;
  description?: string;
}

/**
 * Schema Object: a superset of JSON Schema Draft 2020-12.
 *
 * The union mirrors how documents express schemas in practice; the generator
 * narrows by inspecting keys rather than trusting the declared shape.
 */
export type SchemaObject = SchemaAnnotations &
  (
    | StringSubtype
    | NumberSubtype
    | IntegerSubtype
    | ArraySubtype
    | BooleanSubtype
    | NullSubtype
    | ObjectSubtype
    | {
        type: ('string' | 'number' | 'integer' | 'array' | 'boolean' | 'null' | 'object')[];
      }
  );

interface SchemaAnnotations {
  discriminator?: DiscriminatorObject;
  xml?: XMLObject;
  externalDocs?: ExternalDocumentationObject;
  /** @deprecated in 3.1; retained for 3.0-style documents. */
  example?: unknown;
  title?: string;
  description?: string;
  $comment?: string;
  deprecated?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  enum?: unknown[];
  const?: unknown;
  default?: unknown;
  format?: string;
  /** OpenAPI 3.0 compatibility; 3.1+ expresses nullability via `type`. */
  nullable?: boolean;
  oneOf?: (SchemaObject | ReferenceObject)[];
  allOf?: (SchemaObject | ReferenceObject)[];
  anyOf?: (SchemaObject | ReferenceObject)[];
  required?: string[];
  $defs?: Record<string, SchemaObject>;
}

export interface StringSubtype {
  type: 'string' | ['string', 'null'];
  enum?: (string | ReferenceObject)[];
}

export interface NumberSubtype {
  type: 'number' | ['number', 'null'];
  minimum?: number;
  maximum?: number;
  enum?: (number | ReferenceObject)[];
}

export interface IntegerSubtype {
  type: 'integer' | ['integer', 'null'];
  minimum?: number;
  maximum?: number;
  enum?: (number | ReferenceObject)[];
}

export interface ArraySubtype {
  type: 'array' | ['array', 'null'];
  prefixItems?: (SchemaObject | ReferenceObject)[];
  items?: SchemaObject | ReferenceObject | (SchemaObject | ReferenceObject)[];
  minItems?: number;
  maxItems?: number;
  enum?: (SchemaObject | ReferenceObject)[];
}

export interface BooleanSubtype {
  type: 'boolean' | ['boolean', 'null'];
  enum?: (boolean | ReferenceObject)[];
}

export interface NullSubtype {
  type: 'null';
}

export interface ObjectSubtype {
  type: 'object' | ['object', 'null'];
  properties?: Record<string, SchemaObject | ReferenceObject>;
  additionalProperties?: boolean | Record<string, never> | SchemaObject | ReferenceObject;
  patternProperties?: Record<string, SchemaObject | ReferenceObject>;
  enum?: (SchemaObject | ReferenceObject)[];
}

export interface DiscriminatorObject {
  /** Property in the payload holding the discriminator value. */
  propertyName: string;
  /** Payload values mapped to schema names or references. */
  mapping?: Record<string, string>;
  /** Alternative schema paths matching this discriminator. */
  oneOf?: string[];
}

export interface XMLObject extends Extensions {
  name?: string;
  namespace?: string;
  prefix?: string;
  attribute?: boolean;
  wrapped?: boolean;
}

export type SecuritySchemeObject = Extensions &
  (
    | { type: 'apiKey'; name: string; in: 'query' | 'header' | 'cookie' }
    | { type: 'http'; scheme: string; bearer?: string }
    | { type: 'mutualTLS' }
    | { type: 'oauth2'; flows: OAuthFlowsObject }
    | { type: 'openIdConnect'; openIdConnectUrl: string }
  );

export interface OAuthFlowsObject extends Extensions {
  implicit?: OAuthFlowObject;
  password?: OAuthFlowObject;
  clientCredentials?: OAuthFlowObject;
  authorizationCode?: OAuthFlowObject;
}

export interface OAuthFlowObject extends Extensions {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

export type SecurityRequirementObject = Record<string, string[]>;
