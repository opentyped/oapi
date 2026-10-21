import ts from 'typescript';
import { unwrapExpression } from '~/navigation';
import { sourceOf } from '~/diagnostic';

function expressionSymbol(
  expression: ts.Expression,
  checker: ts.TypeChecker,
): ts.Symbol | undefined {
  const target =
    ts.isElementAccessExpression(expression) &&
    expression.argumentExpression &&
    (ts.isStringLiteralLike(expression.argumentExpression) ||
      ts.isNumericLiteral(expression.argumentExpression))
      ? expression.argumentExpression
      : expression;
  let symbol = checker.getSymbolAtLocation(target);
  if (symbol?.valueDeclaration && ts.isShorthandPropertyAssignment(symbol.valueDeclaration))
    symbol = checker.getShorthandAssignmentValueSymbol(symbol.valueDeclaration);
  if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
  return symbol;
}

export function constantDeclaration(
  expression: ts.Expression,
  checker: ts.TypeChecker,
): ts.VariableDeclaration | ts.EnumMember | undefined {
  const declaration = expressionSymbol(expression, checker)?.valueDeclaration;
  if (declaration && ts.isEnumMember(declaration)) return declaration;
  return declaration &&
    ts.isVariableDeclaration(declaration) &&
    ts.isVariableDeclarationList(declaration.parent) &&
    declaration.parent.flags & ts.NodeFlags.Const
    ? declaration
    : undefined;
}

function exportedExpression(
  expression: ts.Expression,
  checker: ts.TypeChecker,
): ts.Expression | undefined {
  const declaration = expressionSymbol(expression, checker)?.valueDeclaration;
  return declaration && ts.isExportAssignment(declaration) ? declaration.expression : undefined;
}

/** Selects source syntax from static objects/arrays; never reads a runtime object. */
export function constantProperty(
  expression: ts.Expression,
  checker: ts.TypeChecker,
): ts.Expression | undefined {
  let visits = 0;
  const value = (node: ts.Expression, active: Set<ts.Node>): ts.Expression | undefined => {
    if (++visits > 10000 || active.size >= 100)
      return sourceOf(node).fail('Constant property metadata exceeds its traversal budget.');
    if (active.has(node)) return sourceOf(node).fail('Circular constant property metadata.');
    const branch = new Set(active).add(node);
    if (
      ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isTypeAssertionExpression(node) ||
      ts.isSatisfiesExpression(node)
    )
      return value(node.expression, branch);
    const exported = exportedExpression(node, checker);
    if (exported) return value(exported, branch);
    const declaration = constantDeclaration(node, checker);
    if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer)
      return value(declaration.initializer, branch);
    if (
      ts.isIdentifier(node) ||
      ts.isPropertyAccessExpression(node) ||
      ts.isElementAccessExpression(node)
    ) {
      const selected = select(node, branch);
      return selected ? value(selected, branch) : undefined;
    }
    return ts.isObjectLiteralExpression(node) || ts.isArrayLiteralExpression(node)
      ? node
      : undefined;
  };
  const select = (node: ts.Expression, active: Set<ts.Node>): ts.Expression | undefined => {
    let key: string | undefined;
    let target: ts.Expression | undefined;
    if (ts.isIdentifier(node)) {
      const binding = expressionSymbol(node, checker)?.valueDeclaration;
      if (
        !binding ||
        !ts.isBindingElement(binding) ||
        binding.initializer ||
        binding.dotDotDotToken
      )
        return undefined;
      const pattern = binding.parent;
      const declaration = pattern.parent;
      if (
        !ts.isVariableDeclaration(declaration) ||
        !ts.isVariableDeclarationList(declaration.parent) ||
        !(declaration.parent.flags & ts.NodeFlags.Const)
      )
        return undefined;
      target = declaration.initializer;
      if (ts.isArrayBindingPattern(pattern)) key = String(pattern.elements.indexOf(binding));
      else if (ts.isObjectBindingPattern(pattern)) {
        const name = binding.propertyName ?? binding.name;
        if (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name))
          key = name.text;
      }
    } else if (ts.isPropertyAccessExpression(node)) {
      key = node.name.text;
      target = node.expression;
    } else if (ts.isElementAccessExpression(node)) {
      const argument = node.argumentExpression;
      if (argument && (ts.isStringLiteralLike(argument) || ts.isNumericLiteral(argument)))
        key = argument.text;
      target = node.expression;
    }
    if (key === undefined || !target) return undefined;
    const receiver = value(target, active);
    if (!receiver) return undefined;
    if (ts.isArrayLiteralExpression(receiver)) {
      if (
        receiver.elements.length > 10000 ||
        receiver.elements.some((item) => ts.isSpreadElement(item) || ts.isOmittedExpression(item))
      )
        return sourceOf(node).fail('Constant array selection requires static elements.');
      const index = Number(key);
      return /^(0|[1-9][0-9]*)$/.test(key) &&
        Number.isSafeInteger(index) &&
        index < receiver.elements.length
        ? receiver.elements[index]
        : undefined;
    }
    if (!ts.isObjectLiteralExpression(receiver)) return undefined;
    let selected: ts.Expression | undefined;
    const names = new Set<string>();
    for (const property of receiver.properties) {
      if (++visits > 10000)
        return sourceOf(node).fail('Constant property metadata exceeds its traversal budget.');
      if (
        ts.isSpreadAssignment(property) ||
        !property.name ||
        (!ts.isIdentifier(property.name) &&
          !ts.isStringLiteralLike(property.name) &&
          !ts.isNumericLiteral(property.name))
      )
        return sourceOf(property).fail(
          'Constant property selection requires static keys without spreads.',
        );
      const name = property.name.text;
      if (names.has(name)) return sourceOf(property).fail(`Duplicate constant property ${name}.`);
      names.add(name);
      if (name === key && name === '__proto__' && ts.isPropertyAssignment(property))
        return sourceOf(property).fail(
          'Constant property selection cannot use an object literal prototype setter. Use a named const value.',
        );
      if (name === key)
        selected = ts.isPropertyAssignment(property)
          ? property.initializer
          : ts.isShorthandPropertyAssignment(property)
            ? property.name
            : undefined;
    }
    return selected;
  };
  return select(expression, new Set());
}

/** Resolves a static object through const aliases and static property selections. */
export function constantObject(
  expression: ts.Expression,
  checker: ts.TypeChecker,
): ts.ObjectLiteralExpression | undefined {
  const active = new Set<ts.Node>();
  let current: ts.Expression | undefined = expression;
  while (current) {
    if (active.has(current)) return sourceOf(expression).fail('Circular constant object metadata.');
    if (active.size >= 100)
      return sourceOf(expression).fail('Constant object metadata exceeds 100 levels.');
    active.add(current);
    current = unwrapExpression(current);
    if (ts.isObjectLiteralExpression(current)) return current;
    const exported = exportedExpression(current, checker);
    if (exported) {
      current = exported;
      continue;
    }
    const declaration = constantDeclaration(current, checker);
    current =
      declaration && ts.isVariableDeclaration(declaration)
        ? declaration.initializer
        : constantProperty(current, checker);
  }
  return undefined;
}

/** Evaluates string-only constant syntax; never invokes application code or trusts asserted types. */
export class ConstantString {
  constructor(private readonly checker: ts.TypeChecker) {}

  read(expression: ts.Expression): string {
    return this.resolve(expression, new Set(), { steps: 0 });
  }

  private resolve(
    expression: ts.Expression,
    active: Set<ts.Node>,
    budget: { steps: number },
  ): string {
    const source = sourceOf(expression);
    if (++budget.steps > 10000)
      return source.fail('Constant string metadata exceeds 10000 evaluation steps.');
    if (active.has(expression)) return source.fail('Circular constant string metadata.');
    if (active.size >= 100) return source.fail('Constant string metadata exceeds 100 levels.');
    const branch = new Set(active).add(expression);
    if (ts.isStringLiteralLike(expression)) return this.bounded(expression.text, expression);
    if (
      ts.isParenthesizedExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isTypeAssertionExpression(expression) ||
      ts.isSatisfiesExpression(expression)
    )
      return this.resolve(expression.expression, branch, budget);
    if (
      ts.isBinaryExpression(expression) &&
      expression.operatorToken.kind === ts.SyntaxKind.PlusToken
    )
      return this.bounded(
        this.resolve(expression.left, branch, budget) +
          this.resolve(expression.right, branch, budget),
        expression,
      );
    if (ts.isTemplateExpression(expression)) {
      let value = expression.head.text;
      for (const span of expression.templateSpans)
        value = this.bounded(
          value + this.resolve(span.expression, branch, budget) + span.literal.text,
          expression,
        );
      return value;
    }
    const exported = exportedExpression(expression, this.checker);
    if (exported) return this.resolve(exported, branch, budget);
    const selected = constantProperty(expression, this.checker);
    if (selected) return this.resolve(selected, branch, budget);
    if (ts.isIdentifier(expression) || ts.isPropertyAccessExpression(expression)) {
      const declaration = constantDeclaration(expression, this.checker);
      if (
        declaration &&
        ts.isVariableDeclaration(declaration) &&
        declaration.initializer &&
        ts.isVariableDeclarationList(declaration.parent)
      )
        return this.resolve(declaration.initializer, branch, budget);
      if (declaration && ts.isEnumMember(declaration)) {
        const value = this.checker.getConstantValue(declaration);
        if (typeof value === 'string') return value;
      }
    }
    return source.fail(
      'Metadata must be a static string literal or const string expression; runtime values are unsupported.',
    );
  }
  private bounded(value: string, expression: ts.Expression): string {
    if (value.length > 65536)
      return sourceOf(expression).fail('Constant string metadata exceeds 65536 characters.');
    return value;
  }
}
