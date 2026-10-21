import { modelDeclaration } from '~/parser/declaration';
import type { ModelDeclaration } from '~/parser/declaration';
import { handlerContract } from '~/parser/endpoint/handler';
import ts from 'typescript';
import { sourceOf } from '@typedapi/ast/diagnostic';

export function markedDeclaration(
  node: ts.Node,
  annotations: ReadonlyMap<string, string>,
  checker: ts.TypeChecker,
): ModelDeclaration {
  // Keep legacy /:name shorthand at discovery; HTTP assembly receives OpenAPI paths.
  const canonical = new Map(annotations);
  for (const key of ['route', 'contextPath']) {
    const value = canonical.get(key);
    if (value !== undefined)
      canonical.set(key, value.replace(/\/:([A-Za-z_][A-Za-z0-9_]*)/g, '/{$1}'));
  }
  annotations = canonical;
  const source = sourceOf(node);
  if (annotations.has('route') && annotations.has('webhook'))
    source.fail('A contract cannot be both @route and @webhook.');
  const operation = annotations.has('route') || annotations.has('webhook');
  if (ts.isVariableStatement(node) && operation) {
    if (annotations.has('schema')) return source.fail('A handler cannot be marked as a schema.');
    const handler = handlerContract(node, checker);
    return {
      ...handler,
      source,
      annotations,
      emitSchema: false,
      emitOperation: true,
      emitResponse: false,
    };
  }
  if (operation && ts.isEnumDeclaration(node))
    source.fail('@route/@webhook must mark an interface or type alias.');
  if (annotations.get('response'))
    source.fail(
      '@response takes no arguments. Rename the declaration to change its response name.',
    );
  return modelDeclaration(node, annotations, {
    emitOperation: operation,
    emitResponse: annotations.has('response'),
  });
}
