import ts from 'typescript';
import { SchemaProjection } from '~/projection';
import type { TypeBindings } from '~/projection';
import { SchemaError } from '~/error';

export interface Origin {
  key: ts.TypeNode;
  value: ts.Node;
  bindings: TypeBindings;
}

/** Recover written index values through aliases, mapped types and inheritance. */
export class IndexOrigins {
  private readonly projection: SchemaProjection;

  constructor(
    private readonly checker: ts.TypeChecker,
    root: string,
  ) {
    this.projection = new SchemaProjection(checker, root);
  }

  of(node: ts.Node | undefined, bindings: TypeBindings, seen = new Set<ts.Node>()): Origin[] {
    if (!node || seen.has(node)) return [];
    seen.add(node);
    if (ts.isTypeAliasDeclaration(node)) return this.of(node.type, bindings, seen);
    if (ts.isParenthesizedTypeNode(node)) return this.of(node.type, bindings, seen);
    if (ts.isIntersectionTypeNode(node))
      return node.types.flatMap((part) => this.of(part, bindings, new Set(seen)));
    if (
      ts.isTypeLiteralNode(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isClassDeclaration(node)
    ) {
      const own = node.members.flatMap((member) =>
        ts.isIndexSignatureDeclaration(member) && member.type && member.parameters[0]?.type
          ? [{ key: member.parameters[0].type, value: member.type, bindings }]
          : [],
      );
      const inherited =
        'heritageClauses' in node
          ? (node.heritageClauses ?? []).flatMap((clause) =>
              clause.types.flatMap((base) => this.of(base, bindings, new Set(seen))),
            )
          : [];
      return [...own, ...inherited];
    }
    if (ts.isMappedTypeNode(node)) {
      const keys = node.typeParameter.constraint;
      if (keys && ts.isTypeOperatorNode(keys) && keys.operator === ts.SyntaxKind.KeyOfKeyword)
        return this.of(keys.type, bindings, seen);
      if (node.nameType && keys && this.projection.containsOrigins(keys, bindings))
        throw new SchemaError('Remapped pattern key annotations require an explicit model', node);
      return keys && node.type ? [{ key: node.nameType ?? keys, value: node.type, bindings }] : [];
    }
    if (!(
      ts.isTypeReferenceNode(node) ||
      ts.isImportTypeNode(node) ||
      ts.isExpressionWithTypeArguments(node)
    ))
      return [];
    const location = ts.isTypeReferenceNode(node)
      ? node.typeName
      : ts.isImportTypeNode(node)
        ? (node.qualifier ?? node)
        : node.expression;
    let symbol = this.checker.getSymbolAtLocation(location);
    if (symbol?.flags && symbol.flags & ts.SymbolFlags.Alias)
      symbol = this.checker.getAliasedSymbol(symbol);
    const declaration = symbol?.declarations?.find(
      (node) =>
        ts.isTypeAliasDeclaration(node) ||
        ts.isInterfaceDeclaration(node) ||
        ts.isClassDeclaration(node),
    );
    if (!declaration) return [];
    if (declaration.getSourceFile().hasNoDefaultLib) {
      if (symbol?.name === 'Record' && node.typeArguments?.[0] && node.typeArguments[1])
        return [{ key: node.typeArguments[0], value: node.typeArguments[1], bindings }];
      return ['Readonly', 'Partial', 'Required', 'Pick', 'Omit'].includes(symbol?.name ?? '')
        ? this.of(node.typeArguments?.[0], bindings, seen)
        : [];
    }
    return this.of(declaration, this.projection.bind(node, declaration, bindings), seen);
  }
}
