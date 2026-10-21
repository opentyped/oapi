import ts from 'typescript';
import { sourceOf } from '~/diagnostic';
import { ConstantString, constantDeclaration, constantProperty } from '~/constant';

export type JsonValue =
  null | boolean | number | string | readonly JsonValue[] | { [key: string]: JsonValue };

/** Reads JSON-shaped constant syntax without evaluating application code. */
export class ConstantJson {
  private readonly strings: ConstantString;
  constructor(
    private readonly checker: ts.TypeChecker,
    private readonly origin?: ts.Node,
  ) {
    this.strings = new ConstantString(checker);
  }

  read(expression: ts.Expression): JsonValue {
    return this.resolve(expression, new Set(), { nodes: 0 });
  }

  private resolve(
    expression: ts.Expression,
    active: Set<ts.Node>,
    budget: { nodes: number },
  ): JsonValue {
    const source = sourceOf(this.origin ?? expression);
    if (++budget.nodes > 10000 || active.size >= 100)
      return source.fail('Constant JSON metadata exceeds its traversal budget.');
    if (active.has(expression)) return source.fail('Circular constant JSON metadata.');
    const branch = new Set(active).add(expression);
    if (
      ts.isParenthesizedExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isTypeAssertionExpression(expression) ||
      ts.isSatisfiesExpression(expression)
    )
      return this.resolve(expression.expression, branch, budget);
    if (ts.isStringLiteralLike(expression)) return expression.text;
    if (
      ts.isTemplateExpression(expression) ||
      (ts.isBinaryExpression(expression) &&
        expression.operatorToken.kind === ts.SyntaxKind.PlusToken)
    )
      return this.strings.read(expression);
    if (expression.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (expression.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (expression.kind === ts.SyntaxKind.NullKeyword) return null;
    if (ts.isNumericLiteral(expression)) {
      const value = Number(expression.text);
      if (!Number.isFinite(value)) return source.fail('JSON metadata numbers must be finite.');
      return value;
    }
    if (
      ts.isPrefixUnaryExpression(expression) &&
      [ts.SyntaxKind.PlusToken, ts.SyntaxKind.MinusToken].includes(expression.operator)
    ) {
      const value = this.resolve(expression.operand, branch, budget);
      if (typeof value !== 'number') return source.fail('JSON numeric signs require a number.');
      return expression.operator === ts.SyntaxKind.MinusToken ? -value : value;
    }
    if (ts.isArrayLiteralExpression(expression))
      return expression.elements.map((item) => this.resolve(item, branch, budget));
    if (ts.isObjectLiteralExpression(expression)) {
      const result: Record<string, JsonValue> = Object.create(null) as Record<string, JsonValue>;
      for (const property of expression.properties) {
        if (
          (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) ||
          (!ts.isIdentifier(property.name) && !ts.isStringLiteralLike(property.name))
        )
          return source.fail(
            'JSON metadata requires static properties; spreads, getters and methods are unsupported.',
          );
        if (Object.hasOwn(result, property.name.text))
          return source.fail(`Duplicate JSON metadata property ${property.name.text}.`);
        result[property.name.text] = this.resolve(
          ts.isShorthandPropertyAssignment(property) ? property.name : property.initializer,
          branch,
          budget,
        );
      }
      return result;
    }
    const selected = constantProperty(expression, this.checker);
    if (selected) return this.resolve(selected, branch, budget);
    if (
      ts.isIdentifier(expression) ||
      ts.isPropertyAccessExpression(expression) ||
      ts.isElementAccessExpression(expression)
    ) {
      const declaration = constantDeclaration(expression, this.checker);
      if (declaration && ts.isEnumMember(declaration)) {
        const value = this.checker.getConstantValue(declaration);
        if (typeof value === 'number' && !Number.isFinite(value))
          return source.fail('JSON metadata numbers must be finite.');
        if (value !== undefined) return value;
      }
      if (
        declaration &&
        ts.isVariableDeclaration(declaration) &&
        declaration.initializer &&
        ts.isVariableDeclarationList(declaration.parent)
      )
        return this.resolve(declaration.initializer, branch, budget);
    }
    return source.fail(
      'JSON metadata must use static literals or const initializers; runtime expressions are unsupported.',
    );
  }
}
