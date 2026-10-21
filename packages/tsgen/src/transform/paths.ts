import ts from 'typescript';
import { createRef } from '~/pointer';
import { jsdocComment, modifiers, NEVER, propertyIndex, QUESTION_TOKEN, refType } from '~/ast';
import { getEntries } from '~/resolve';
import { operationMembers, parameterMembers, registerOperation } from '~/transform/operations';
import type { Context } from '~/context';
import type {
  OperationObject,
  ParameterObject,
  PathItemObject,
  PathsObject,
  ReferenceObject,
} from '~/types';

/** Operations a path item may carry, including the OpenAPI 3.2 `query`. */
export const METHODS = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
  'query',
] as const;
export type Method = (typeof METHODS)[number];

/** Path Item Object: shared parameters, operations, and 3.2 extensions. */
export function pathItemType(pathItem: PathItemObject, ctx: Context, path: string): ts.TypeNode {
  const members: ts.TypeElement[] = parameterMembers(
    pathItem.parameters ?? [],
    ctx,
    createRef([path, 'parameters']),
  );
  for (const method of METHODS) {
    members.push(
      operationProperty(method, pathItem[method], pathItem, ctx, createRef([path, method])),
    );
  }
  if (pathItem.additionalOperations) {
    const custom = Object.entries(pathItem.additionalOperations).map(([method, operation]) =>
      operationProperty(
        method,
        operation,
        pathItem,
        ctx,
        createRef([path, 'additionalOperations', method]),
      ),
    );
    members.push(
      ts.factory.createPropertySignature(
        modifiers({ readonly: ctx.immutable }),
        'additionalOperations',
        /* questionToken */ undefined,
        ts.factory.createTypeLiteralNode(custom),
      ),
    );
  }
  return ts.factory.createTypeLiteralNode(members);
}

function operationProperty(
  name: string,
  input: OperationObject | ReferenceObject | undefined,
  pathItem: PathItemObject,
  ctx: Context,
  path: string,
): ts.PropertySignature {
  const operation = input && ('$ref' in input ? ctx.resolve<OperationObject>(input.$ref) : input);
  if (!operation) {
    return ts.factory.createPropertySignature(
      modifiers({ readonly: ctx.immutable }),
      propertyIndex(name),
      QUESTION_TOKEN,
      NEVER,
    );
  }

  // Path-item parameters sit behind the operation's own; keys are `in:name`.
  const parameters = new Map<string, ParameterObject | ReferenceObject>();
  for (const parameter of [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])]) {
    const resolved = '$ref' in parameter ? ctx.resolve<ParameterObject>(parameter.$ref) : parameter;
    if (!resolved) throw new Error(`Cannot resolve operation parameter at ${path}`);
    parameters.set(`${resolved.in}:${resolved.name}`, parameter);
  }
  const merged: OperationObject = { ...operation, parameters: [...parameters.values()] };

  let type: ts.TypeNode;
  if (operation.operationId) {
    type = refType(createRef(['operations', operation.operationId]));
    registerOperation(operation.operationId, merged, ctx, path);
  } else {
    type = ts.factory.createTypeLiteralNode(operationMembers(merged, ctx, path));
  }
  const property = ts.factory.createPropertySignature(
    modifiers({ readonly: ctx.immutable }),
    propertyIndex(name),
    /* questionToken */ undefined,
    type,
  );
  jsdocComment(operation, property);
  return property;
}

/** Paths Object: one property per route. */
export function pathsType(paths: PathsObject, ctx: Context): ts.TypeNode {
  const members: ts.TypeElement[] = [];
  for (const [url, pathItem] of getEntries(paths, ctx)) {
    if (!pathItem || typeof pathItem !== 'object') continue;
    if ('$ref' in pathItem) {
      const property = ts.factory.createPropertySignature(
        modifiers({ readonly: ctx.immutable }),
        propertyIndex(url),
        /* questionToken */ undefined,
        refType(pathItem.$ref),
      );
      jsdocComment(pathItem, property);
      members.push(property);
    } else {
      members.push(
        ts.factory.createPropertySignature(
          modifiers({ readonly: ctx.immutable }),
          propertyIndex(url),
          /* questionToken */ undefined,
          pathItemType(pathItem, ctx, createRef(['paths', url])),
        ),
      );
    }
  }
  return ts.factory.createTypeLiteralNode(members);
}
