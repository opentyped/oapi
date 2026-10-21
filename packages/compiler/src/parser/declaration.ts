import ts from 'typescript';
import { sourceOf } from '@typedapi/ast/diagnostic';
import type { Source } from '@typedapi/openapi/diagnostic';

export type ModelNode =
  ts.InterfaceDeclaration | ts.TypeAliasDeclaration | ts.EnumDeclaration | ts.ClassDeclaration;
export interface ModelDeclaration {
  node: ModelNode | ts.TypeNode;
  name: string;
  output?: ts.TypeNode;
  source: Source;
  /** Discovery normalizes endpoint routes to OpenAPI {name} syntax. */
  annotations: ReadonlyMap<string, string>;
  additionalTags?: readonly string[];
  emitSchema: boolean;
  emitOperation: boolean;
  emitResponse: boolean;
}

/** Naming protocol supplied by the generation entry point. */
export interface ModelIdentity {
  name(node: ts.Node): string | undefined;
  namespace?(node: ts.Node): string | undefined;
  canonical?(node: ts.Node): ts.Node;
  generatedName?(preferred: string): string;
}

export function modelDeclaration(
  node: ts.Node,
  annotations: ReadonlyMap<string, string>,
  flags: { emitOperation: boolean; emitResponse: boolean },
): ModelDeclaration {
  const source = sourceOf(node);
  if (
    !ts.isInterfaceDeclaration(node) &&
    !ts.isTypeAliasDeclaration(node) &&
    !ts.isEnumDeclaration(node) &&
    !ts.isClassDeclaration(node)
  ) {
    return source.fail('@schema/@route must mark an interface, type alias, enum, or class.');
  }
  if (!node.name) return source.fail('Marked models require a name.');
  if (!ts.isSourceFile(node.parent))
    source.fail('Marked contracts must be top-level declarations.');
  if ('typeParameters' in node && node.typeParameters?.length)
    source.fail('Mark a concrete instantiation (type UserPage = Page<User>), not an open generic.');
  if (annotations.get('schema'))
    source.fail('@schema takes no arguments. Rename the declaration to change its schema name.');
  return {
    node,
    name: node.name.text,
    source,
    annotations,
    emitSchema: annotations.has('schema'),
    ...flags,
  };
}
