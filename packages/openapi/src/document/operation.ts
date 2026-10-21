import { DEFAULT_OPENAPI } from '~/document/definition';
import { operationMethods } from '~/document/visitor';
import type { CallbackCompiler, PathItem } from '~/document/definition';
import { record, specificationExtensions } from '~/document/metadata';
import { Security } from '~/document/security';
import type { ExternalDocumentationObject } from 'openapi3-ts/oas32';
import type { DocumentOptions } from '~/document/definition';
import type { Source } from '~/diagnostic';
import type { Components } from '~/schema/definition';
import { objectSchema, namedObjectSchema } from '~/schema/shape';
import type { ResponseLookup } from '~/document/response';
import type { Operation } from '~/document/definition';
import { compileParameters } from '~/document/parameter';
import { compileResponses } from '~/document/response';
import { compileRequest, compileQueryString } from '~/document/request';

import type { OperationContract } from '~/document/definition';
export interface CompiledOperation {
  path: string;
  method: string;
  operation: Operation;
  kind: 'path' | 'webhook';
}

/** Fixed operation fields use lowercase keys; extension method tokens retain their case. */
export function httpMethod(value: string, source: Source): string {
  if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(value))
    return source.fail(`Invalid HTTP method token ${JSON.stringify(value)}.`);
  const lower = value.toLowerCase();
  return operationMethods.has(lower) ? lower : value;
}

export function putOperation(item: PathItem, method: string, operation: Operation): boolean {
  const target = operationMethods.has(method)
    ? item
    : (item.additionalOperations ??= Object.create(null) as Record<string, Operation>);
  if (Object.hasOwn(target, method)) return false;
  Object.defineProperty(target, method, {
    value: operation,
    enumerable: true,
    configurable: true,
    writable: true,
  });
  return true;
}

function parseRoute(
  annotation: string,
  source: Source,
  contextPath = '',
): { path: string; method: string; names: string[] } {
  const match = /^(\S+)\s+(\/\S*)$/.exec(annotation);
  if (!match) return source.fail('@route must be METHOD /path.');
  const method = httpMethod(match[1]!, source);
  if (contextPath && !contextPath.startsWith('/')) source.fail('contextPath must start with /.');
  const path = contextPath.replace(/\/$/, '') + match[2]!;
  if (/[?#*]/.test(path) || /[{}]/.test(path.replace(/\{[\p{ID_Continue}$.-]+\}/gu, '')))
    source.fail(`Unsupported route syntax: ${path}. Use literal paths and named {parameters}.`);
  const names = [...path.matchAll(/\{([^}]+)\}/g)].map((item) => item[1]!);
  if (new Set(names).size !== names.length) source.fail(`Repeated path parameter in ${path}.`);
  return { path, method, names };
}

function parseWebhook(
  annotation: string,
  source: Source,
): { path: string; method: string; names: string[] } {
  const match = /^(\S+)\s+(.+)$/.exec(annotation);
  if (!match || !match[2]!.trim()) return source.fail('@webhook must be METHOD event-name.');
  const method = httpMethod(match[1]!, source);
  return { path: match[2]!.trim(), method, names: [] };
}

function securityRequirements(
  text: string,
  security: Security,
  source: Source,
): Record<string, string[]>[] {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return source.fail('@security must contain a JSON array of security requirements.');
  }
  return security.requirements(value, source);
}

function metadata(
  contract: OperationContract,
  options: DocumentOptions,
  result: Operation,
  securityModel?: Security,
): void {
  const { annotations, source } = contract;
  if (!result.operationId.trim()) source.fail('operationId cannot be empty.');
  const summary = annotations.get('summary');
  if (summary) result.summary = summary;
  const description = annotations.get('description');
  if (description) result.description = description;
  const tags = annotations.get('tags');
  const structuredTags = annotations.get('tagsJSON');
  if (structuredTags !== undefined) {
    let value: unknown;
    try {
      value = JSON.parse(structuredTags);
    } catch {
      return source.fail('Endpoint tags require a JSON string array.');
    }
    if (!Array.isArray(value) || !value.every((tag) => typeof tag === 'string'))
      return source.fail('Endpoint tags require a JSON string array.');
    result.tags = value;
  } else if (tags)
    result.tags = tags
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  if (contract.additionalTags?.length)
    result.tags = [...new Set([...(result.tags ?? []), ...contract.additionalTags])];
  if (annotations.has('deprecated')) result.deprecated = annotations.get('deprecated') !== 'false';
  const docs = annotations.get('externalDocs');
  if (docs !== undefined) {
    let value: unknown;
    try {
      value = JSON.parse(docs);
    } catch {
      return source.fail('@externalDocs must contain a JSON object.');
    }
    result.externalDocs = record(
      value,
      source,
      'externalDocs',
    ) as unknown as ExternalDocumentationObject;
  }
  const servers = annotations.get('servers');
  if (servers !== undefined) {
    let value: unknown;
    try {
      value = JSON.parse(servers);
    } catch {
      return source.fail('@servers must contain a JSON array of Server Objects.');
    }
    if (!Array.isArray(value))
      return source.fail('@servers must contain a JSON array of Server Objects.');
    result.servers = value;
  }
  const extensions = annotations.get('extensions');
  if (extensions !== undefined) {
    let value: unknown;
    try {
      value = JSON.parse(extensions);
    } catch {
      return source.fail('@extensions must contain a JSON object.');
    }
    Object.assign(result, specificationExtensions(value, source));
  }
  const security = annotations.get('security');
  if (security !== undefined)
    result.security = securityRequirements(
      security,
      securityModel ?? new Security(options.securitySchemes ?? {}, source, options.openapi),
      source,
    );
}

/** Expands method lists after registration, keeping one selectable source declaration. */
export function compileOperations(
  contract: OperationContract,
  components: Components,
  options: DocumentOptions,
  responses?: ResponseLookup,
  security?: Security,
  callbacks?: CallbackCompiler,
): CompiledOperation[] {
  const route = contract.annotations.get('route');
  const match = route && /^(\S+)\s+(\/\S*)$/.exec(route);
  if (!match || !match[1]!.includes(','))
    return [compileOperation(contract, components, options, responses, security, callbacks)];
  const operationId = contract.annotations.get('operationId') ?? contract.name;
  if (!operationId.trim()) contract.source.fail('operationId cannot be empty.');
  const verbs = match[1]!.split(',').map((method) => httpMethod(method, contract.source));
  if (new Set(verbs).size !== verbs.length)
    contract.source.fail('Duplicate HTTP method in @route.');
  return verbs.map((verb) => {
    const annotations = new Map(contract.annotations);
    annotations.set('route', `${verb} ${match[2]}`);
    annotations.set('operationId', `${operationId}_${verb}`);
    return compileOperation(
      { ...contract, annotations },
      components,
      options,
      responses,
      security,
      callbacks,
    );
  });
}

/** Pure HTTP assembly: consumes schemas and metadata, never TypeScript nodes or a compiler. */
function compileOperation(
  contract: OperationContract,
  components: Components,
  options: DocumentOptions,
  responses?: ResponseLookup,
  security?: Security,
  callbacks?: CallbackCompiler,
): CompiledOperation {
  const { annotations, source } = contract;
  const webhook = annotations.get('webhook');
  if (webhook !== undefined && annotations.has('route'))
    source.fail('A contract cannot be both @route and @webhook.');
  if (webhook !== undefined && annotations.has('contextPath'))
    source.fail('Webhook names do not use contextPath.');
  const route =
    webhook !== undefined
      ? parseWebhook(webhook, source)
      : parseRoute(annotations.get('route')!, source, annotations.get('contextPath'));
  const result = compileHttpOperation(
    contract,
    route.method,
    webhook !== undefined ? undefined : route.names,
    components,
    options,
    responses,
    security,
    callbacks,
  );
  return {
    path: route.path,
    method: route.method,
    operation: result,
    kind: webhook !== undefined ? 'webhook' : 'path',
  };
}

/** Shared HTTP payload assembly for routes, webhooks and callback operations. */
export function compileHttpOperation(
  contract: OperationContract,
  method: string,
  names: string[] | undefined,
  components: Components,
  options: DocumentOptions,
  responses?: ResponseLookup,
  security?: Security,
  callbacks?: CallbackCompiler,
): Operation {
  const { annotations, source } = contract;
  if (method === 'query' && (options.openapi ?? DEFAULT_OPENAPI) !== '3.2.0')
    source.fail('QUERY operations require OpenAPI 3.2.0.');
  if (!operationMethods.has(method) && (options.openapi ?? DEFAULT_OPENAPI) !== '3.2.0')
    source.fail(`Additional HTTP method ${method} requires OpenAPI 3.2.0.`);
  const schema = namedObjectSchema(contract.schema, components, source, 'Operation contract');
  const fields = schema.properties ?? {};
  const allowed = new Set([
    'params',
    'query',
    'querystring',
    'headers',
    'cookies',
    'body',
    'requestBody',
    'responses',
    'callbacks',
  ]);
  for (const key of Object.keys(fields))
    if (!allowed.has(key)) source.fail(`Unknown operation field ${key}.`);
  if (!fields.responses) return source.fail('Operation requires responses.');
  const result: Operation = {
    operationId: annotations.get('operationId') ?? contract.name,
    responses: compileResponses(fields.responses, method, components, source, responses),
  };
  metadata(contract, options, result, security);
  const pathNames =
    names === undefined && fields.params
      ? Object.keys(
          objectSchema(fields.params, components, source, 'Operation params').properties ?? {},
        )
      : (names ?? []);
  const parameters = compileParameters(fields, pathNames, components, source);
  const querystring = compileQueryString(schema, components, source, options.openapi);
  if (querystring) parameters.push(querystring);
  for (const name of pathNames)
    if (!parameters.some((item) => item.in === 'path' && item.name === name))
      source.fail(`Missing params.${name} in operation ${result.operationId}.`);
  if (parameters.length) result.parameters = parameters;
  const requestBody = compileRequest(schema, annotations, components, source);
  if (requestBody) {
    if (method === 'trace') source.fail('TRACE requests cannot have a body.');
    result.requestBody = requestBody;
  }
  if (fields.callbacks) {
    if (!callbacks) source.fail('Callback compilation is unavailable.');
    result.callbacks = callbacks!.compile(fields.callbacks, result.operationId, source);
  }
  return result;
}
