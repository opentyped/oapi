import type { Source } from '~/diagnostic';
import type { Extensions } from '~/json';
import type {
  InfoObject,
  TagObject,
  ExternalDocumentationObject,
  ServerObject,
  MediaTypeObject,
  OpenAPIObject,
  ComponentsObject,
  OperationObject,
  PathItemObject,
  ParameterObject,
  RequestBodyObject,
  ResponseObject,
  SecuritySchemeObject,
  OAuthFlowsObject,
  OAuthFlowObject,
  ReferenceObject,
  HeaderObject,
  EncodingPropertyObject,
} from 'openapi3-ts/oas32';
import type { Schema, Components } from '~/schema/definition';

export const DEFAULT_OPENAPI = '3.2.0';

/** Declaration tags consumed by document construction rather than schema interpretation. */
export const operationAnnotations: ReadonlySet<string> = new Set([
  'route',
  'webhook',
  'summary',
  'tags',
  'tagsJSON',
  'operationId',
  'security',
  'requestContentType',
  'contextPath',
  'externalDocs',
  'servers',
  'openapiContract',
]);

export type HeaderDefinitions = Record<string, HeaderObject | ReferenceObject>;
/** Device authorization requires the URLs and scopes emitted by our generator. */
export interface DeviceAuthorizationFlow extends OAuthFlowObject {
  deviceAuthorizationUrl: string;
  tokenUrl: string;
  scopes: Record<string, string>;
}
export interface OAuthFlows extends OAuthFlowsObject {
  deviceAuthorization?: DeviceAuthorizationFlow;
}
export interface SecurityScheme extends Omit<SecuritySchemeObject, 'flows'> {
  flows?: OAuthFlows;
}
export type SecuritySchemes = Record<string, SecurityScheme | ReferenceObject>;

export type Tag = TagObject;

/** Document configuration uses the specification library's data types directly. */
export interface DocumentOptions {
  /** Output specification version. Defaults to 3.2.0. */
  openapi?: '3.1.0' | '3.2.0';
  /** OpenAPI 3.2 document identity used for object-reference resolution. */
  $self?: string;
  info: InfoObject;
  servers?: ServerObject[];
  tags?: Tag[];
  externalDocs?: ExternalDocumentationObject;
  extensions?: Extensions;
  securitySchemes?: SecuritySchemes;
  headers?: HeaderDefinitions;
  security?: Record<string, string[]>[];
}

/** Compiler invariants refine the specification library's HTTP model. */
export type Parameter = Omit<ParameterObject, 'schema' | 'content'> & HeaderRepresentation;
export interface Encoding extends EncodingPropertyObject {
  headers?: Record<string, Header | ReferenceObject>;
}
export interface MediaContent extends MediaTypeObject {
  schema?: Schema;
  itemSchema?: Schema;
  encoding?: Record<string, Encoding>;
}
export type Content = Record<string, MediaContent | ReferenceObject>;
export type HeaderRepresentation =
  { schema: Schema; content?: never } | { schema?: never; content: Content };
export type Header = Omit<HeaderObject, '$ref'> & HeaderRepresentation;
export interface Response extends ResponseObject {
  content?: Content;
  headers?: Record<string, Header | ReferenceObject>;
}
export interface RequestBody extends RequestBodyObject {
  content: Content;
}
export interface Operation extends Omit<OperationObject, 'parameters' | 'callbacks'> {
  operationId: string;
  responses?: Record<string, Response | ReferenceObject>;
  parameters?: (Parameter | ReferenceObject)[];
  requestBody?: RequestBody | ReferenceObject;
  callbacks?: Record<string, Callback | ReferenceObject>;
}
export interface PathItem extends Omit<
  PathItemObject,
  'parameters' | 'get' | 'put' | 'post' | 'delete' | 'options' | 'head' | 'patch' | 'trace'
> {
  parameters?: (Parameter | ReferenceObject)[];
  get?: Operation;
  put?: Operation;
  post?: Operation;
  delete?: Operation;
  options?: Operation;
  head?: Operation;
  patch?: Operation;
  trace?: Operation;
  query?: Operation;
  additionalOperations?: Record<string, Operation>;
}
export type Callback = Record<string, PathItem>;

export interface OpenApiDocument extends Omit<OpenAPIObject, 'components' | 'paths' | 'webhooks'> {
  openapi: '3.1.0' | '3.2.0';
  tags?: Tag[];
  jsonSchemaDialect: string;
  paths: Record<string, PathItem>;
  webhooks?: Record<string, PathItem>;
  components: Omit<
    ComponentsObject,
    | 'schemas'
    | 'callbacks'
    | 'securitySchemes'
    | 'responses'
    | 'headers'
    | 'parameters'
    | 'pathItems'
  > & {
    schemas: Components;
    parameters?: Record<string, ParameterObject | ReferenceObject>;
    pathItems?: Record<string, PathItem | ReferenceObject>;
    callbacks?: Record<string, Callback | ReferenceObject>;
    securitySchemes?: SecuritySchemes;
    responses?: Record<string, Response | ReferenceObject>;
    headers?: Record<string, Header | ReferenceObject>;
  };
}

export interface OperationContract {
  name: string;
  annotations: ReadonlyMap<string, string>;
  additionalTags?: readonly string[];
  source: Source;
  schema: Schema;
}
/** Port implemented by callback assembly and consumed by HTTP operation assembly. */
export interface CallbackCompiler {
  compile(schema: Schema, owner: string, source: Source): NonNullable<Operation['callbacks']>;
}
