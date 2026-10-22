import type { RouterMounts } from '~/parser/router';
import { ExpressRegistration, openApiPaths } from '~/parser/route';
import { endpointMetadata } from '~/parser/metadata';
import ts from 'typescript';
import { annotationsOf } from '@opentyped/oapi-compiler/parser/annotation';
import { sourceOf } from '@opentyped/oapi-ast/diagnostic';
import { constantObject } from '@opentyped/oapi-ast/constant';
import type { ModelDeclaration } from '@opentyped/oapi-compiler/parser/declaration';
import type { Source } from '@opentyped/oapi-openapi/diagnostic';

/** Route-derived names remain stable when handlers are renamed or shared between routers. */
function operationName(method: string, path: string, source: Source): string {
  const verb = method
    .toLowerCase()
    .replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
  const words = path.replace(/\{([^}]+)\}/g, '/by/$1/').match(/[\p{L}\p{N}]+/gu) ?? [];
  if (!words.length && path !== '/')
    return source.fail(
      'Cannot derive a readable operationId from this path. Provide operationId explicitly.',
    );
  const name = words
    .map((word) => {
      const [first, ...rest] = [...word];
      return first!.toUpperCase() + rest.join('');
    })
    .join('');
  return verb + (name || 'Root');
}

/** Match the resolved API declaration, never a coincidentally named user method. */
export function endpointDeclarations(
  call: ts.CallExpression,
  checker: ts.TypeChecker,
  prefix = '',
  route?: { method: string; path: string },
): ModelDeclaration[] {
  const signature = checker.getResolvedSignature(call)?.declaration;
  if (!signature) return [];
  const markers = annotationsOf(signature);
  const wrapped = markers.has('openapiHandler');
  if (!wrapped && !markers.has('openapiMount')) return [];
  const source = sourceOf(call);
  const node = call.typeArguments?.[0];
  if (!node || ![1, 2].includes(call.typeArguments?.length ?? 0))
    return source.fail('Endpoint registration requires a contract type or Input and Output types.');
  const argument = call.arguments[wrapped ? 0 : 1];
  const options = argument && constantObject(argument, checker);
  if (!options || !ts.isObjectLiteralExpression(options))
    return source.fail(
      'Endpoint metadata requires a static object literal or const object reference.',
    );
  const metadata = endpointMetadata(options, source, checker);
  let method = metadata.get('method');
  let path = metadata.get('path');
  if (wrapped) {
    const registration = route ?? new ExpressRegistration(checker).read(call);
    method = 'method' in registration ? registration.method : registration.methods[0];
    path = 'path' in registration ? registration.path : registration.paths[0];
  }
  if (!method || !path) return source.fail('mount requires explicit method and path.');
  path = prefix + path;
  metadata.delete('method');
  metadata.delete('path');
  const variants = openApiPaths(path, source, call.getSourceFile().fileName);
  if (variants.length > 1 && metadata.has('operationId'))
    return source.fail(
      'Optional Express paths require generated operation IDs; omit operationId to give each variant a unique ID.',
    );
  return variants.map((path) => {
    const name = metadata.get('operationId') ?? operationName(method, path, source);
    const annotations = new Map(metadata);
    annotations.set('route', `${method} ${path}`);
    annotations.set('operationId', name);
    return {
      node,
      ...(call.typeArguments?.[1] ? { output: call.typeArguments[1] } : {}),
      name,
      source,
      annotations,
      emitSchema: false,
      emitOperation: true,
      emitResponse: false,
    };
  });
}

export function mountedDeclarations(
  call: ts.CallExpression,
  checker: ts.TypeChecker,
  routers: RouterMounts,
  additionalMethods = false,
): ModelDeclaration[] {
  const signature = checker.getResolvedSignature(call)?.declaration;
  if (!signature) return [];
  const markers = annotationsOf(signature);
  const wrapped = markers.has('openapiHandler');
  if (!wrapped && !markers.has('openapiMount')) return [];
  const registration = wrapped
    ? new ExpressRegistration(checker, additionalMethods).read(call)
    : undefined;
  const target = wrapped ? new ExpressRegistration(checker).target(call) : call.arguments[0]!;
  const prefixes = routers.prefixes(target);
  const paths = registration?.paths ?? [''];
  const methods = registration?.methods ?? [''];
  if (prefixes.length * paths.length * methods.length > 1000)
    return sourceOf(call).fail('Express registrations expand beyond 1000 paths.');
  const result: ModelDeclaration[] = [];
  for (const prefix of prefixes) {
    for (const path of paths) {
      for (const method of methods) {
        const incoming = endpointDeclarations(
          call,
          checker,
          prefix,
          registration ? { method, path } : undefined,
        );
        if (result.length + incoming.length > 1000)
          return sourceOf(call).fail('Express registrations expand beyond 1000 paths.');
        result.push(...incoming);
      }
    }
  }
  return result;
}
