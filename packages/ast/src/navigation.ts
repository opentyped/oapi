import ts from 'typescript';
import { sourceOf } from '~/diagnostic';

/** Removes syntax wrappers without evaluating the expression or trusting asserted types. */
export function unwrapExpression(expression: ts.Expression): ts.Expression {
  let depth = 0;
  while (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isTypeAssertionExpression(expression) ||
    ts.isSatisfiesExpression(expression) ||
    ts.isNonNullExpression(expression)
  ) {
    if (++depth > 100) return sourceOf(expression).fail('Expression wrappers exceed 100 levels.');
    expression = expression.expression;
  }
  return expression;
}

/** Removes transparent parentheses while preserving the referenced type's source node. */
export function unwrapType(node: ts.TypeNode): ts.TypeNode {
  let depth = 0;
  while (ts.isParenthesizedTypeNode(node)) {
    if (++depth > 100) return sourceOf(node).fail('Type wrappers exceed 100 levels.');
    node = node.type;
  }
  return node;
}

/** Native NoInfer is an identity substitution constrained by unknown. */
export function unwrapNoInfer(type: ts.Type): ts.Type {
  while (type.flags & ts.TypeFlags.Substitution) {
    const substitution = type as ts.SubstitutionType;
    if (!(substitution.constraint.flags & ts.TypeFlags.Unknown)) break;
    type = substitution.baseType;
  }
  return type;
}

/** Retrieves a written type without resolving or interpreting domain annotations. */
export function typeNodeOf(node: ts.Node): ts.TypeNode | undefined {
  if (ts.isTypeNode(node)) return node;
  if (
    ts.isPropertySignature(node) ||
    ts.isPropertyDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isParameter(node)
  )
    return node.type;
  if (ts.isSetAccessorDeclaration(node)) return node.parameters[0]?.type;
  return undefined;
}

export interface ResolvedProperty {
  symbol: ts.Symbol;
  name: string;
  node: ts.Node;
  type: ts.Type;
  optional: boolean;
}

/** TypeScript escapes leading underscores on string keys, but leaves symbol-key sentinels intact. */
export function symbolProperty(property: ts.Symbol): boolean {
  return String(property.escapedName).startsWith('__@');
}

/** Resolves properties after generic substitution, preserving each declaration's source location. */
export function propertiesOf(
  checker: ts.TypeChecker,
  type: ts.Type,
  fallback: ts.Node,
): ResolvedProperty[] {
  return checker.getPropertiesOfType(type).map((property) => {
    const node = property.valueDeclaration ?? property.declarations?.[0] ?? fallback;
    return {
      symbol: property,
      name: property.name,
      node,
      type: checker.getTypeOfSymbolAtLocation(property, node),
      optional: !!(property.flags & ts.SymbolFlags.Optional),
    };
  });
}

export function tupleElementsOf(
  checker: ts.TypeChecker,
  type: ts.TupleTypeReference,
): { type: ts.Type; optional: boolean; rest: boolean }[] {
  return checker.getTypeArguments(type).map((element, index) => ({
    type: element,
    optional: !!((type.target.elementFlags[index] ?? 0) & ts.ElementFlags.Optional),
    rest: !!(
      (type.target.elementFlags[index] ?? 0) &
      (ts.ElementFlags.Rest | ts.ElementFlags.Variadic)
    ),
  }));
}

export function builtInName(type: ts.Type): string | undefined {
  const symbol = type.getSymbol();
  if (!symbol || symbol.name.startsWith('__')) return undefined;
  const standard = symbol.declarations?.some((node) =>
    /[\\/]typescript[\\/]lib[\\/]lib\..*\.d\.ts$/.test(node.getSourceFile().fileName),
  );
  return standard ? symbol.name : undefined;
}

/** Recognizes mapped values that read the corresponding source property. */
export function indexedMapping(node: ts.MappedTypeNode, checker: ts.TypeChecker): boolean {
  const constraint = node.typeParameter.constraint;
  const value = node.type;
  return (
    !!constraint &&
    ts.isTypeOperatorNode(constraint) &&
    constraint.operator === ts.SyntaxKind.KeyOfKeyword &&
    !!value &&
    ts.isIndexedAccessTypeNode(value) &&
    ts.isTypeReferenceNode(value.indexType) &&
    ts.isIdentifier(value.indexType.typeName) &&
    value.indexType.typeName.text === node.typeParameter.name.text &&
    checker.getTypeAtLocation(value.objectType) === checker.getTypeAtLocation(constraint.type)
  );
}

/** Recognizes key-preserving identity maps, including readonly/optional modifiers. */
export function identityMapping(node: ts.MappedTypeNode, checker: ts.TypeChecker): boolean {
  return (
    indexedMapping(node, checker) &&
    (!node.nameType ||
      checker.getTypeAtLocation(node.nameType) ===
        checker.getTypeAtLocation(node.typeParameter.name))
  );
}

/** Resolves the source of transparent aliases that only change property mutability. */
export function mutabilitySource(
  type: ts.Type,
  checker: ts.TypeChecker,
  active = new Set<ts.Type>(),
): ts.Type | undefined {
  if (active.has(type) || active.size >= 100) return undefined;
  const next = new Set(active).add(type);
  const declaration = type.aliasSymbol?.declarations?.find(ts.isTypeAliasDeclaration);
  if (!declaration) return undefined;
  const bindings = new Map<ts.Symbol, ts.Type>();
  declaration.typeParameters?.forEach((parameter, index) => {
    const symbol = checker.getSymbolAtLocation(parameter.name);
    const argument = type.aliasTypeArguments?.[index];
    if (symbol && argument) bindings.set(symbol, argument);
  });
  const resolve = (node: ts.TypeNode): ts.Type => {
    const value = checker.getTypeFromTypeNode(node);
    const symbol = value.flags & ts.TypeFlags.TypeParameter ? value.getSymbol() : undefined;
    return (symbol && bindings.get(symbol)) || value;
  };
  let current = unwrapType(declaration.type);
  const seen = new Set<ts.Node>();
  while (!seen.has(current) && seen.size < 100) {
    seen.add(current);
    if (ts.isMappedTypeNode(current)) {
      if (current.questionToken || !identityMapping(current, checker)) return undefined;
      const source = resolve((current.typeParameter.constraint as ts.TypeOperatorNode).type);
      return mutabilitySource(source, checker, next) ?? source;
    }
    if (!ts.isTypeReferenceNode(current)) return undefined;
    const reference = current;
    let symbol = checker.getSymbolAtLocation(current.typeName);
    if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
    const alias = symbol?.declarations?.find(ts.isTypeAliasDeclaration);
    if (!alias) return undefined;
    const arguments_ = alias.typeParameters?.map((parameter, index) => {
      const node = reference.typeArguments?.[index] ?? parameter.default;
      return node && resolve(node);
    });
    alias.typeParameters?.forEach((parameter, index) => {
      const symbol = checker.getSymbolAtLocation(parameter.name);
      const argument = arguments_?.[index];
      if (symbol && argument) bindings.set(symbol, argument);
    });
    current = unwrapType(alias.type);
  }
  return undefined;
}

/** Follows transparent type aliases while retaining original concrete argument nodes. */
export function aliasTarget(
  reference: ts.TypeReferenceNode,
  checker: ts.TypeChecker,
  accepts: (declaration: ts.TypeAliasDeclaration) => boolean,
): { declaration: ts.TypeAliasDeclaration; arguments: readonly ts.TypeNode[] } | undefined {
  const bindings = new Map<ts.Symbol, ts.TypeNode>();
  const active = new Set<ts.Node>();
  const argument = (input: ts.TypeNode): ts.TypeNode => {
    let current = unwrapType(input);
    const seen = new Set<ts.Node>();
    while (ts.isTypeReferenceNode(current)) {
      if (seen.has(current) || seen.size >= 100)
        return sourceOf(input).fail('Type alias arguments exceed their resolution budget.');
      seen.add(current);
      const symbol = checker.getSymbolAtLocation(current.typeName);
      const bound = symbol && bindings.get(symbol);
      if (!bound) break;
      current = unwrapType(bound);
    }
    return current;
  };
  let current: ts.TypeNode = reference;
  while (ts.isTypeReferenceNode(current)) {
    if (active.has(current) || active.size >= 100)
      return sourceOf(reference).fail('Type aliases exceed 100 resolution steps.');
    active.add(current);
    let symbol = checker.getSymbolAtLocation(current.typeName);
    if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
    const declaration = symbol?.declarations?.find(ts.isTypeAliasDeclaration);
    if (!declaration) return undefined;
    const inputs = current.typeArguments;
    const arguments_ = (declaration.typeParameters ?? []).flatMap((parameter, index) => {
      const input = inputs?.[index] ?? parameter.default;
      if (!input) return [];
      const value = argument(input);
      const symbol = checker.getSymbolAtLocation(parameter.name);
      if (symbol) bindings.set(symbol, value);
      return [value];
    });
    if (accepts(declaration)) {
      let steps = 0;
      const unresolved = (node: ts.Node): boolean => {
        if (++steps > 10000)
          return sourceOf(reference).fail('Type alias arguments exceed 10000 syntax nodes.');
        const symbol = ts.isTypeReferenceNode(node)
          ? checker.getSymbolAtLocation(node.typeName)
          : undefined;
        return !!(symbol && bindings.has(symbol)) || !!ts.forEachChild(node, unresolved);
      };
      if (arguments_.some(unresolved))
        return sourceOf(reference).fail(
          'Nested generic alias arguments require an explicit concrete type alias.',
        );
      return { declaration, arguments: arguments_ };
    }
    current = unwrapType(declaration.type);
  }
  return undefined;
}
