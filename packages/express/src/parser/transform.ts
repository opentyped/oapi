import ts from 'typescript';
import { realpathSync } from 'node:fs';
import MagicString from 'magic-string';
import type { Project } from '@opentyped/ast/project';
import { annotationsOf } from '@opentyped/compiler/parser/annotation';
import { endpointDeclarations } from '~/parser/declaration';
import { unwrapExpression } from '@opentyped/ast/navigation';
import { constantDeclaration } from '@opentyped/ast/constant';

/** Erases recognized registration calls while preserving argument evaluation and source maps. */
export class RegistrationTransform {
  private readonly sources: Map<string, ts.SourceFile>;

  constructor(
    private readonly project: Project,
    sources: ReadonlySet<ts.SourceFile>,
  ) {
    this.sources = new Map(
      [...sources].flatMap((source) => [
        [source.fileName, source] as const,
        [realpathSync.native(source.fileName), source] as const,
      ]),
    );
  }

  source(file: string): string | undefined {
    return this.sources.get(file)?.text;
  }

  private binding(
    input: ts.Expression,
    signature: NonNullable<ts.Signature['declaration']>,
    active = new Set<ts.Node>(),
  ): ts.Symbol | undefined {
    if (active.has(input) || active.size >= 100 || ts.isOptionalChain(input)) return undefined;
    const expression = unwrapExpression(input);
    if (ts.isOptionalChain(expression)) return undefined;
    const branch = new Set(active).add(input);
    let target: ts.Node = expression;
    if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
      if (!this.binding(expression.expression, signature, branch)) return undefined;
      if (ts.isPropertyAccessExpression(expression)) target = expression.name;
      else {
        if (
          !expression.argumentExpression ||
          !ts.isStringLiteralLike(expression.argumentExpression)
        )
          return undefined;
        target = expression.argumentExpression;
      }
    } else if (!ts.isIdentifier(expression)) return undefined;
    const checker = this.project.checker;
    let symbol = checker.getSymbolAtLocation(target);
    if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
    let declaration = symbol?.valueDeclaration;
    if (declaration && ts.isShorthandPropertyAssignment(declaration)) {
      symbol = checker.getShorthandAssignmentValueSymbol(declaration);
      declaration = symbol?.valueDeclaration;
    }
    if (
      declaration &&
      ts.isPropertySignature(declaration) &&
      declaration.type &&
      ts.isTypeQueryNode(declaration.type)
    ) {
      symbol = checker.getSymbolAtLocation(declaration.type.exprName);
      declaration = symbol?.valueDeclaration;
    }
    if (symbol?.declarations?.includes(signature)) return symbol;
    if (declaration && ts.isSourceFile(declaration)) return symbol;
    if (declaration && ts.isExportAssignment(declaration)) {
      if (declaration.getSourceFile() !== signature.getSourceFile()) return undefined;
      if (
        ts.isObjectLiteralExpression(declaration.expression) &&
        declaration.getSourceFile() === signature.getSourceFile()
      )
        return symbol;
      return this.binding(declaration.expression, signature, branch);
    }
    if (
      declaration &&
      ts.isVariableDeclaration(declaration) &&
      !declaration.initializer &&
      declaration.getSourceFile().isDeclarationFile &&
      declaration.getSourceFile() === signature.getSourceFile()
    )
      return symbol;
    const constant = constantDeclaration(expression, checker);
    return constant &&
      ts.isVariableDeclaration(constant) &&
      constant.initializer &&
      constant.getSourceFile() === input.getSourceFile() &&
      constant.initializer.end <= input.getStart()
      ? this.binding(constant.initializer, signature, branch)
      : undefined;
  }

  apply(code: string, file: string): { code: string; map: string } | undefined {
    const source = this.sources.get(file);
    if (!source || source.text !== code) return undefined;
    const output = new MagicString(code);
    let recognized = false;
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) {
        const signature = this.project.checker.getResolvedSignature(node)?.declaration;
        const markers = signature && annotationsOf(signature);
        if (markers?.has('openapiMount') || markers?.has('openapiHandler')) {
          // Use the same validation rules as document discovery.
          endpointDeclarations(node, this.project.checker);
          recognized = true;
          const expectedArguments = markers.has('openapiHandler') ? 1 : 2;
          const binding =
            ts.isOptionalChain(node) || node.arguments.length !== expectedArguments
              ? undefined
              : this.binding(node.expression, signature!);
          if (!binding?.declarations?.includes(signature!)) {
            ts.forEachChild(node, visit);
            return;
          }
          const first = node.arguments[0]!;
          if (markers.has('openapiHandler')) {
            output.overwrite(node.getStart(source), first.getStart(source), '(');
            if (node.arguments.hasTrailingComma)
              output.remove(node.arguments.end - 1, node.arguments.end);
            output.appendLeft(node.end, '.handler');
          } else {
            output.overwrite(
              node.getStart(source),
              first.getStart(source),
              '((router, endpoint) => { router[endpoint.method.toLowerCase()](endpoint.path, ...(endpoint.middleware ?? []), endpoint.handler); })(',
            );
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    if (!output.hasChanged() && !recognized) return undefined;
    return {
      code: output.toString(),
      map: output.generateMap({ source: file, includeContent: true, hires: true }).toString(),
    };
  }
}
