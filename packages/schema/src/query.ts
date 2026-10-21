import ts from 'typescript';

type QueryOrigin =
  | ts.TypeNode
  | ts.VariableDeclaration
  | ts.PropertyDeclaration
  | ts.PropertySignature
  | ts.ParameterDeclaration;

/** Follow declared value origins without evaluating their initializers. */
export function queryOrigin(
  syntax: ts.TypeQueryNode | ts.ImportTypeNode,
  checker: ts.TypeChecker,
): QueryOrigin | undefined {
  const seen = new Set<ts.Node>();
  const declaration = (symbol: ts.Symbol | undefined): QueryOrigin | undefined => {
    if (symbol?.flags && symbol.flags & ts.SymbolFlags.Alias)
      symbol = checker.getAliasedSymbol(symbol);
    const node = symbol?.valueDeclaration ?? symbol?.declarations?.[0];
    if (!node || seen.has(node)) return undefined;
    seen.add(node);
    if (
      ts.isVariableDeclaration(node) ||
      ts.isPropertyDeclaration(node) ||
      ts.isPropertySignature(node) ||
      ts.isParameter(node)
    ) {
      if (node.type) return node;
      if ('initializer' in node && node.initializer) return expression(node.initializer);
    }
    return undefined;
  };
  const expression = (node: ts.Expression): QueryOrigin | undefined => {
    if (ts.isParenthesizedExpression(node) || ts.isNonNullExpression(node))
      return expression(node.expression);
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) return node.type;
    if (ts.isIdentifier(node) || ts.isPropertyAccessExpression(node))
      return declaration(checker.getSymbolAtLocation(node));
    if (ts.isCallExpression(node)) {
      const signature = checker.getResolvedSignature(node)?.getDeclaration();
      return signature?.typeParameters?.length ? undefined : signature?.type;
    }
    return undefined;
  };
  return declaration(
    checker.getSymbolAtLocation(
      ts.isTypeQueryNode(syntax) ? syntax.exprName : (syntax.qualifier ?? syntax),
    ),
  );
}
