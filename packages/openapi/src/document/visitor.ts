import type { OpenAPIObject, ServerObject } from 'openapi3-ts/oas32';
import { DocumentReferences } from '~/document/reference';
import { GenerationError } from '~/diagnostic';

export const referenceSections: Readonly<Record<string, string>> = {
  pathItem: 'pathItems',
  callbackObject: 'callbacks',
  parameterObject: 'parameters',
  requestBody: 'requestBodies',
  requestBodyObject: 'requestBodies',
  responseObject: 'responses',
  mediaObject: 'mediaTypes',
  headerObject: 'headers',
  exampleObject: 'examples',
  linkObject: 'links',
  securitySchemeObject: 'securitySchemes',
};

/** Traversal roles distinguish OpenAPI maps and fields from arbitrary example/extension data. */
const mapValues: Record<string, string> = {
  paths: 'pathItem',
  headers: 'headerObject',
  responses: 'responseObject',
  content: 'mediaObject',
  callbacks: 'callbackObject',
  callbackObject: 'pathItem',
  webhooks: 'pathItem',
  links: 'linkObject',
  securitySchemes: 'securitySchemeObject',
  requestBodies: 'requestBodyObject',
  parameters: 'parameterObject',
  examples: 'exampleObject',
  pathItems: 'pathItem',
  encoding: 'encodingObject',
  mediaTypes: 'mediaObject',
  additionalOperations: 'operationObject',
};
export const operationMethods: ReadonlySet<string> = new Set([
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
  'query',
]);

/** Includes OpenAPI 3.2 QUERY and additional HTTP methods without treating metadata as operations. */
export function operationsOf(item: Record<string, unknown>): unknown[] {
  const additional = item.additionalOperations;
  return [
    ...Object.entries(item)
      .filter(([key]) => operationMethods.has(key))
      .map(([, value]) => value),
    ...(additional && typeof additional === 'object' && !Array.isArray(additional)
      ? Object.values(additional)
      : []),
  ];
}
export interface DocumentVisitor {
  object?(object: Record<string, unknown>, role: string, parent?: Record<string, unknown>): void;
  schema?(
    value: unknown,
    owner: Record<string, unknown>,
    key: string,
    path: readonly string[],
  ): void;
}

export function visitDocument(
  value: unknown,
  visitor: DocumentVisitor,
  role = 'document',
  parent?: Record<string, unknown>,
  path: readonly string[] = [],
): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const [index, child] of value.entries())
      visitDocument(child, visitor, role === 'parameters' ? 'parameterObject' : role, parent, [
        ...path,
        String(index),
      ]);
    return;
  }
  const object = value as Record<string, unknown>;
  visitor.object?.(object, role, parent);
  const map = Object.hasOwn(mapValues, role);
  for (const [key, child] of Object.entries(object)) {
    if (
      (key.startsWith('x-') && (!map || ['paths', 'responses', 'callbackObject'].includes(role))) ||
      (!map && key === 'example') ||
      (role === 'exampleObject' && ['value', 'dataValue', 'serializedValue'].includes(key))
    )
      continue;
    if (role === 'linkObject' && ['requestBody', 'parameters'].includes(key)) continue;
    if ((key === 'schema' && !map) || (key === 'itemSchema' && role === 'mediaObject')) {
      visitor.schema?.(child, object, key, [...path, key]);
      continue;
    }
    if (key === 'schemas' && role === 'components') {
      if (child && typeof child === 'object')
        for (const [name, schema] of Object.entries(child))
          visitor.schema?.(schema, child as Record<string, unknown>, name, [...path, key, name]);
      continue;
    }
    const childRole =
      role === 'pathItem' && operationMethods.has(key)
        ? 'operationObject'
        : (mapValues[role] ?? key);
    visitDocument(child, visitor, childRole, role === 'additionalOperations' ? parent : object, [
      ...path,
      key,
    ]);
  }
}

/** Semantic traversal follows local object references without inspecting unrelated payload data. */
export function visitResolvedDocument(
  document: unknown,
  references: {
    resolve(
      ref: string,
      onTarget?: (target: Record<string, unknown>, path: readonly string[]) => void,
    ): unknown;
  },
  visitor: DocumentVisitor,
): void {
  const owned = new Map<string, WeakSet<object>>();
  const followed = new Map<string, WeakSet<object>>();
  const key = (role: string): string =>
    Object.hasOwn(referenceSections, role) ? referenceSections[role]! : role;
  const remember = (map: Map<string, WeakSet<object>>, role: string, value: object): boolean => {
    const name = key(role);
    const values = map.get(name) ?? new WeakSet<object>();
    if (values.has(value)) return true;
    values.add(value);
    map.set(name, values);
    return false;
  };
  visitDocument(document, { object: (object, role) => void remember(owned, role, object) });
  let depth = 0;
  const resolved: DocumentVisitor = {
    ...(visitor.schema ? { schema: visitor.schema } : {}),
    object(object, role, parent) {
      visitor.object?.(object, role, parent);
      if (!Object.hasOwn(referenceSections, role) || typeof object.$ref !== 'string') return;
      let path: readonly string[] = [];
      const target = references.resolve(object.$ref, (_target, location) => {
        path = location;
      });
      if (!target || typeof target !== 'object' || Array.isArray(target)) return;
      if (owned.get(key(role))?.has(target) || remember(followed, role, target)) return;
      if (depth >= 100) throw new GenerationError('OpenAPI object references exceed 100 levels.');
      depth++;
      try {
        visitDocument(target, resolved, role, parent, path);
      } finally {
        depth--;
      }
    },
  };
  visitDocument(document, resolved);
}

/** Copies a document for Scalar's structural check without changing emitted contracts. */
export function validationDocument(document: OpenAPIObject): OpenAPIObject {
  // Scalar 0.1.13 rejects Link.server and treats callback x- data as Path Items.
  const structural = structuredClone(document);
  const pathReferences: Record<string, unknown>[] = [];
  visitResolvedDocument(structural, new DocumentReferences(structural), {
    object(object, role) {
      if (
        role === 'pathItem' &&
        typeof object.$ref === 'string' &&
        Object.keys(object).some((key) => !['$ref', 'summary', 'description'].includes(key))
      )
        pathReferences.push(object);
      if (role === 'linkObject' && object.server !== undefined) {
        structural.servers ??= [];
        structural.servers.push(object.server as ServerObject);
        delete object.server;
      }
      if (role === 'callbackObject')
        for (const key of Object.keys(object)) if (key.startsWith('x-')) delete object[key];
    },
  });
  // Scalar treats a Path Item with $ref as a Reference Object, rejecting valid siblings.
  // Follow the graph first so validation still visits locally referenced definitions.
  for (const item of pathReferences) delete item.$ref;
  return structural;
}
