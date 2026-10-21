import ts from 'typescript';
import { createRef } from '~/pointer';
import {
  jsdocComment,
  modifiers,
  NEVER,
  propertyIndex,
  QUESTION_TOKEN,
  refType,
  unionType,
  UNKNOWN,
} from '~/ast';
import { mediaTypeType, requestBodyType, responsesType } from '~/transform/content';
import { schemaType } from '~/transform/schema';
import type { Context } from '~/context';
import type { OperationObject, ParameterObject, ReferenceObject, RequestBodyObject } from '~/types';

/** Parameter Object: schema or content media types; absent both widen to `unknown`. */
export function parameterType(parameter: ParameterObject, ctx: Context, path: string): ts.TypeNode {
  if (parameter.schema !== undefined) return schemaType(parameter.schema, ctx, path);
  if (parameter.content) {
    return unionType(
      Object.values(parameter.content).map((media) => mediaTypeType(media, ctx, path)),
    );
  }
  return UNKNOWN;
}

/**
 * Parameters of an operation or path item, grouped into
 * `parameters: { query?: ...; header?: ...; path?: ...; cookie?: ... }`.
 */
export function parameterMembers(
  parameters: (ParameterObject | ReferenceObject)[],
  ctx: Context,
  path: string,
): ts.TypeElement[] {
  const locations: ParameterObject['in'][] = ['query', 'header', 'path', 'cookie'];
  if (
    parameters.some(
      (input) =>
        ('$ref' in input ? ctx.resolve<ParameterObject>(input.$ref) : input)?.in === 'querystring',
    )
  ) {
    locations.push('querystring');
  }

  const members: ts.TypeElement[] = [];
  for (const location of locations) {
    const located: ts.TypeElement[] = [];
    const resolvedParameters = parameters.map((param) => ({
      original: param,
      resolved: '$ref' in param ? ctx.resolve<ParameterObject>(param.$ref) : param,
    }));
    if (ctx.alphabetize) {
      resolvedParameters.sort((a, b) =>
        (a.resolved?.name ?? '').localeCompare(b.resolved?.name ?? ''),
      );
    }
    for (const { original, resolved } of resolvedParameters) {
      if (!resolved || resolved.in !== location) continue;
      const optional = location !== 'path' && !resolved.required ? QUESTION_TOKEN : undefined;
      const type =
        '$ref' in original
          ? refType(original.$ref, resolved)
          : parameterType(
              resolved,
              ctx,
              createRef([path, 'parameters', resolved.in, resolved.name]),
            );
      const property = ts.factory.createPropertySignature(
        modifiers({ readonly: ctx.immutable }),
        propertyIndex(resolved.name),
        optional,
        type,
      );
      jsdocComment(resolved, property);
      located.push(property);
    }
    const allOptional = located.every((node) => Boolean(node.questionToken));
    members.push(
      ts.factory.createPropertySignature(
        modifiers({ readonly: ctx.immutable }),
        propertyIndex(location),
        allOptional || !located.length ? QUESTION_TOKEN : undefined,
        located.length ? ts.factory.createTypeLiteralNode(located) : NEVER,
      ),
    );
  }

  return [
    ts.factory.createPropertySignature(
      modifiers({ readonly: ctx.immutable }),
      propertyIndex('parameters'),
      /* questionToken */ members.length ? undefined : QUESTION_TOKEN,
      members.length ? ts.factory.createTypeLiteralNode(members) : NEVER,
    ),
  ];
}

/** Operation Object: parameters, request body, responses. */
export function operationMembers(
  operation: OperationObject,
  ctx: Context,
  path: string,
): ts.TypeElement[] {
  const members: ts.TypeElement[] = parameterMembers(operation.parameters ?? [], ctx, path);

  if (operation.requestBody) {
    const bodyType =
      '$ref' in operation.requestBody
        ? refType(operation.requestBody.$ref)
        : requestBodyType(operation.requestBody, ctx, createRef([path, 'requestBody']));
    const resolved =
      '$ref' in operation.requestBody
        ? ctx.resolve<RequestBodyObject>(operation.requestBody.$ref)
        : operation.requestBody;
    const property = ts.factory.createPropertySignature(
      modifiers({ readonly: ctx.immutable }),
      propertyIndex('requestBody'),
      /* questionToken */ resolved?.required ? undefined : QUESTION_TOKEN,
      bodyType,
    );
    jsdocComment(operation.requestBody, property);
    members.push(property);
  } else {
    members.push(
      ts.factory.createPropertySignature(
        modifiers({ readonly: ctx.immutable }),
        propertyIndex('requestBody'),
        QUESTION_TOKEN,
        NEVER,
      ),
    );
  }

  members.push(
    ts.factory.createPropertySignature(
      modifiers({ readonly: ctx.immutable }),
      propertyIndex('responses'),
      /* questionToken */ undefined,
      responsesType(operation.responses ?? {}, ctx, path),
    ),
  );
  return members;
}

/**
 * Add an operation to the top-level `operations` interface, which is emitted
 * in the footer. Operations must have unique ids; duplicates are an error.
 */
export function registerOperation(
  operationId: string,
  operation: OperationObject,
  ctx: Context,
  path: string,
): void {
  const previous = ctx.operationDefinitions.get(operationId);
  if (previous !== undefined) {
    throw new Error(`Duplicate operationId ${operationId}: ${previous} and ${path}`);
  }
  ctx.operationDefinitions.set(operationId, path);

  const signature = ts.factory.createPropertySignature(
    modifiers({ readonly: ctx.immutable }),
    propertyIndex(operationId),
    /* questionToken */ undefined,
    ts.factory.createTypeLiteralNode(operationMembers(operation, ctx, path)),
  );
  const index = ctx.injectFooter.findIndex(
    (node): node is ts.InterfaceDeclaration =>
      ts.isInterfaceDeclaration(node) && node.name.text === 'operations',
  );
  if (index === -1) {
    ctx.injectFooter.push(
      ts.factory.createInterfaceDeclaration(
        modifiers({ export: true }),
        'operations',
        /* typeParameters */ undefined,
        /* heritageClauses */ undefined,
        [signature],
      ),
    );
  } else {
    const current = ctx.injectFooter[index] as ts.InterfaceDeclaration;
    ctx.injectFooter[index] = ts.factory.createInterfaceDeclaration(
      modifiers({ export: true }),
      'operations',
      /* typeParameters */ undefined,
      /* heritageClauses */ undefined,
      [...current.members, signature],
    );
  }
}
