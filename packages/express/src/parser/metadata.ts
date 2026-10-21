import { ConstantJson } from '@typedapi/ast/json';
import { ConstantString } from '@typedapi/ast/constant';
import ts from 'typescript';
import type { Source } from '@typedapi/openapi/diagnostic';
import { annotationsOf } from '@typedapi/compiler/parser/annotation';
import { unwrapExpression } from '@typedapi/ast/navigation';

/** Reads documentation fields without evaluating application expressions. */
export function endpointMetadata(
  options: ts.ObjectLiteralExpression,
  source: Source,
  checker: ts.TypeChecker,
): Map<string, string> {
  const constants = new ConstantString(checker);
  const json = new ConstantJson(checker);
  const metadata = new Map<string, string>();
  const handler = options.properties.find(
    (property) =>
      property.name &&
      (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) &&
      property.name.text === 'handler',
  );
  const documentation: ts.Node[] = [];
  if (handler && (ts.isPropertyAssignment(handler) || ts.isShorthandPropertyAssignment(handler))) {
    const expression = unwrapExpression(
      ts.isPropertyAssignment(handler) ? handler.initializer : handler.name,
    );
    const key =
      ts.isElementAccessExpression(expression) && expression.argumentExpression
        ? checker.getTypeAtLocation(expression.argumentExpression)
        : undefined;
    if (
      ts.isIdentifier(expression) ||
      ts.isPropertyAccessExpression(expression) ||
      key?.isLiteral()
    ) {
      const declaration = checker
        .getTypeAtLocation(expression)
        .getCallSignatures()
        .at(-1)?.declaration;
      if (
        declaration &&
        (ts.isArrowFunction(declaration) || ts.isFunctionExpression(declaration)) &&
        (ts.isVariableDeclaration(declaration.parent) ||
          ts.isPropertyAssignment(declaration.parent) ||
          ts.isPropertyDeclaration(declaration.parent))
      )
        documentation.push(declaration.parent);
      else if (
        declaration &&
        (ts.isFunctionDeclaration(declaration) ||
          ts.isFunctionExpression(declaration) ||
          ts.isMethodDeclaration(declaration))
      )
        documentation.push(declaration);
      let symbol = checker.getSymbolAtLocation(expression);
      if (symbol?.valueDeclaration && ts.isShorthandPropertyAssignment(symbol.valueDeclaration))
        symbol = checker.getShorthandAssignmentValueSymbol(symbol.valueDeclaration);
      if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
      const owner = symbol?.valueDeclaration;
      if (
        owner &&
        (ts.isVariableDeclaration(owner) ||
          ts.isPropertyAssignment(owner) ||
          ts.isPropertyDeclaration(owner)) &&
        !documentation.includes(owner)
      )
        documentation.push(owner);
    }
  }
  if (handler) documentation.push(handler);
  for (const node of documentation) {
    const annotations = annotationsOf(node);
    for (const key of ['summary', 'description', 'deprecated']) {
      const value = annotations.get(key);
      if (value !== undefined) metadata.set(key, value);
    }
  }
  const seen = new Set<string>();
  const strings = new Set([
    'method',
    'path',
    'operationId',
    'summary',
    'description',
    'requestContentType',
  ]);
  const structured = new Set([
    'extensions',
    'externalDocs',
    'tags',
    'security',
    'deprecated',
    'servers',
  ]);
  for (const property of options.properties) {
    if (ts.isSpreadAssignment(property))
      return source.fail('Spread endpoint metadata is not statically discoverable.');
    const name = property.name;
    if (!name || (!ts.isIdentifier(name) && !ts.isStringLiteral(name)))
      return source.fail('Endpoint metadata keys must be static.');
    const key = name.text;
    if (!strings.has(key) && !structured.has(key)) continue;
    if (seen.has(key)) return source.fail(`Duplicate endpoint ${key}.`);
    seen.add(key);
    if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property))
      return source.fail(`${key} requires static metadata.`);
    const expression = ts.isShorthandPropertyAssignment(property)
      ? property.name
      : property.initializer;
    if (strings.has(key)) {
      metadata.set(key, constants.read(expression));
      continue;
    }
    const value = json.read(expression);
    if (key === 'deprecated') {
      if (typeof value !== 'boolean') return source.fail('deprecated must be a constant boolean.');
      if (value) metadata.set(key, 'true');
      else metadata.delete(key);
    } else {
      // Typed tag names may contain commas; JSDoc @tags keeps its legacy text format.
      metadata.set(key === 'tags' ? 'tagsJSON' : key, JSON.stringify(value));
    }
  }
  return metadata;
}
