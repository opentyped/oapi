import { DEFAULT_OPENAPI } from '~/document/definition';
import { publicSchema } from '~/schema/public';
import { HeaderRegistry } from '~/document/header';
import type { Source } from '~/diagnostic';
import { Security } from '~/document/security';
import { specificationExtensions } from '~/document/metadata';
import { GenerationError } from '~/diagnostic';
import type { DocumentOptions } from '~/document/definition';
import type { Compilation } from '~/schema/compilation';
import type { Schema } from '~/schema/definition';
import { DIALECT } from '~/schema/dialect';
import { SchemaGraph } from '~/schema/graph';
import type { SchemaEntry } from '~/schema/resource';
import { visitResolvedDocument } from '~/document/visitor';
import { DocumentReferences } from '~/document/reference';
import { componentName } from '~/schema/reference';
import type { OpenApiDocument, Operation } from '~/document/definition';
import { ResponseRegistry } from '~/document/response';
import { CallbackRegistry } from '~/document/callback';
import { compileHttpOperation, compileOperations, putOperation } from '~/document/operation';

function operationSchemas(operation: Operation, headers: HeaderRegistry, source: Source): Schema[] {
  const schemas: Schema[] = [];
  for (const parameter of operation.parameters ?? []) {
    if ('$ref' in parameter) continue;
    if (parameter.schema) schemas.push(parameter.schema);
    for (const content of Object.values(parameter.content ?? {}))
      schemas.push(...headers.media(content, source));
  }
  const requestBody = operation.requestBody;
  if (requestBody && !('$ref' in requestBody))
    for (const content of Object.values(requestBody.content))
      schemas.push(...headers.media(content, source));
  for (const response of Object.values(operation.responses ?? {})) {
    if ('$ref' in response) continue;
    schemas.push(...headers.response(response, source));
  }
  return schemas;
}

/** Registers operations once, rejects collisions, and omits internal contract envelopes. */
export function compileDocument(
  compilation: Compilation,
  options: DocumentOptions,
  location = 'OpenAPI document',
): { document: OpenApiDocument; schemas: Record<string, Schema> } {
  const { components, declarations } = compilation;
  const source = {
    location,
    fail(message: string): never {
      throw new GenerationError(message);
    },
  };
  const headers = new HeaderRegistry(options.headers ?? {}, components, source);
  const security = new Security(
    options.securitySchemes ?? {},
    source,
    options.openapi,
    undefined,
    options.$self,
  );
  if (options.security !== undefined) security.requirements(options.security);
  const document: OpenApiDocument = {
    openapi: options.openapi ?? DEFAULT_OPENAPI,
    ...(options.$self !== undefined ? { $self: options.$self } : {}),
    jsonSchemaDialect: DIALECT,
    info: options.info,
    paths: Object.create(null) as OpenApiDocument['paths'],
    components: { schemas: components },
    ...(options.tags !== undefined ? { tags: options.tags } : {}),
    ...(options.servers !== undefined ? { servers: options.servers } : {}),
    ...(options.externalDocs !== undefined ? { externalDocs: options.externalDocs } : {}),
    ...(options.extensions !== undefined
      ? specificationExtensions(options.extensions, source)
      : {}),
    ...(options.security ? { security: options.security } : {}),
  };
  if (options.securitySchemes) document.components.securitySchemes = options.securitySchemes;
  if (Object.keys(headers.headers).length) document.components.headers = headers.headers;
  const responses = new ResponseRegistry(compilation.responses, components, headers);
  if (Object.keys(responses.responses).length) document.components.responses = responses.responses;
  const callbacks: CallbackRegistry = new CallbackRegistry(components, (contract, method) =>
    compileHttpOperation(
      contract,
      method,
      undefined,
      components,
      options,
      responses,
      security,
      callbacks,
    ),
  );
  const schemas: Record<string, Schema> = Object.create(null) as Record<string, Schema>;
  const roots: Schema[] = [...responses.payloads(), ...headers.payloads()];
  const ids = new Map<string, string>();
  const paths = new Map<string, string>();
  for (const declaration of declarations) {
    if (declaration.emitSchema) {
      const name = componentName(declaration.name);
      if (Object.hasOwn(schemas, name))
        declaration.source.fail(`Duplicate marked schema ${name}. Rename one of the declarations.`);
      schemas[name] = declaration.schema;
      roots.push(declaration.schema);
    }
    if (!declaration.emitOperation) continue;
    for (const { path, method, operation, kind } of compileOperations(
      declaration,
      components,
      options,
      responses,
      security,
      callbacks,
    )) {
      if (kind === 'path') {
        const shape = path.replace(/\{[^}]+\}/g, '{}');
        if (paths.has(shape) && paths.get(shape) !== path)
          declaration.source.fail(
            `Equivalent templated paths ${paths.get(shape)} and ${path}. Use consistent parameter names.`,
          );
        paths.set(shape, path);
      }
      if (ids.has(operation.operationId))
        declaration.source.fail(
          `Duplicate operationId ${operation.operationId}; first declared at ${ids.get(operation.operationId)}. Provide distinct explicit operation IDs.`,
        );
      ids.set(operation.operationId, declaration.source.location);
      if (kind === 'webhook') {
        document.webhooks ??= Object.create(null) as NonNullable<OpenApiDocument['webhooks']>;
        document.webhooks[path] ??= Object.create(null) as Record<string, Operation>;
        if (!putOperation(document.webhooks[path]!, method, operation))
          declaration.source.fail(`Duplicate webhook operation ${method.toUpperCase()} ${path}.`);
      } else {
        document.paths[path] ??= {};
        if (!putOperation(document.paths[path]!, method, operation))
          declaration.source.fail(`Duplicate operation ${method.toUpperCase()} ${path}.`);
      }
      roots.push(...operationSchemas(operation, headers, declaration.source));
    }
  }
  if (Object.keys(callbacks.callbacks).length) document.components.callbacks = callbacks.callbacks;
  for (const { operation, source } of callbacks.operations)
    roots.push(...operationSchemas(operation, headers, source));
  const entries: SchemaEntry[] = [];
  visitResolvedDocument(document, new DocumentReferences(document), {
    schema: (schema, _owner, _key, path) => {
      entries.push({ schema: schema as Schema | boolean, path });
    },
  });
  const graph = new SchemaGraph(entries, document.$self);
  for (const [name, schema] of Object.entries(schemas)) schemas[name] = graph.bundle(schema);
  document.components.schemas = Object.fromEntries(
    graph
      .reachable(roots)
      .filter(({ path }) => path[0] === 'components' && path[1] === 'schemas')
      .map(({ path }) => [path[2]!, publicSchema(components[path[2]!]!)]),
  );
  return { document, schemas };
}
