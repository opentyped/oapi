import ts from 'typescript';
import { sourceNodes } from '@opentyped/ast/nodes';
import type { Project } from '@opentyped/ast/project';
import { expressMethod, expressPaths, openApiPaths, validateMountPaths } from '~/parser/route';
import { ConstantString, constantDeclaration, constantProperty } from '@opentyped/ast/constant';
import { sourceOf } from '@opentyped/ast/diagnostic';
import { unwrapExpression } from '@opentyped/ast/navigation';

interface Mount {
  parent: ts.Symbol;
  prefix: ts.Expression | undefined;
}

/** Static Express router ownership graph. Prefixes are evaluated only for reachable mounts. */
export class RouterMounts {
  private readonly parents = new Map<ts.Symbol, Mount[]>();
  private readonly constants: ConstantString;
  private readonly checker: ts.TypeChecker;

  constructor(project: Project) {
    this.checker = project.checker;
    this.constants = new ConstantString(project.checker);
    const visit = (node: ts.Node): void => {
      const receiver = ts.isCallExpression(node) ? this.useReceiver(node.expression) : undefined;
      if (ts.isCallExpression(node) && receiver && this.isRouter(receiver)) {
        const children = node.arguments.flatMap((argument) => this.children(argument));
        const parent = children.length ? this.identity(receiver) : undefined;
        if (parent)
          for (const child of children) {
            const symbol = this.identity(child);
            if (!symbol) continue;
            const first = node.arguments[0];
            const prefix = first && !this.middleware(first) ? first : undefined;
            const mounts = this.parents.get(symbol) ?? [];
            mounts.push({ parent, prefix });
            this.parents.set(symbol, mounts);
          }
      }
    };
    for (const source of project.program.getSourceFiles())
      if (!source.isDeclarationFile && !project.program.isSourceFileFromExternalLibrary(source))
        for (const node of sourceNodes(source, [ts.SyntaxKind.CallExpression])) visit(node);
  }

  prefixes(target: ts.Expression): string[] {
    const identity = this.identity(target);
    return identity ? [...new Set(this.walk(identity, target, new Set()))] : [''];
  }

  private walk(symbol: ts.Symbol, target: ts.Expression, active: Set<ts.Symbol>): string[] {
    const source = sourceOf(target);
    if (active.has(symbol)) return source.fail('Circular Express router mounts.');
    if (active.size >= 100) return source.fail('Express router mounts exceed 100 levels.');
    const parents = this.parents.get(symbol);
    if (!parents) return [''];
    const branch = new Set(active).add(symbol);
    const result: string[] = [];
    for (const mount of parents) {
      const prefixes = mount.prefix ? expressPaths(mount.prefix, this.checker) : [''];
      for (const prefix of prefixes) {
        if (prefix && openApiPaths(prefix, source, target.getSourceFile().fileName).length > 1)
          return source.fail(
            'Optional router mount prefixes require separate static mounts to avoid ambiguous prefix matching.',
          );
        if (prefix && !prefix.startsWith('/'))
          return source.fail('Router mount prefixes must start with /.');
      }
      validateMountPaths(prefixes, source);
      for (const prefix of prefixes) {
        for (const parent of this.walk(mount.parent, target, branch)) {
          result.push(parent.replace(/\/$/, '') + prefix.replace(/\/$/, ''));
          if (result.length > 1000)
            return source.fail('Express router mounts expand beyond 1000 paths.');
        }
      }
    }
    return result;
  }

  private useReceiver(expression: ts.Expression): ts.Expression | undefined {
    if (ts.isPropertyAccessExpression(expression) && expression.name.text === 'use')
      return expression.expression;
    if (
      ts.isElementAccessExpression(expression) &&
      expression.argumentExpression &&
      this.isRouter(expression.expression) &&
      this.constants.read(expression.argumentExpression) === 'use'
    )
      return expression.expression;
    return undefined;
  }

  private elements(
    expression: ts.Expression,
    active = new Set<ts.Node>(),
    budget = { nodes: 0 },
  ): ts.Expression[] {
    if (++budget.nodes > 10000 || active.size >= 100 || active.has(expression))
      return sourceOf(expression).fail('Circular or excessive Express middleware arrays.');
    const branch = new Set(active).add(expression);
    if (
      ts.isParenthesizedExpression(expression) ||
      ts.isSpreadElement(expression) ||
      ts.isAsExpression(expression) ||
      ts.isTypeAssertionExpression(expression) ||
      ts.isSatisfiesExpression(expression)
    )
      return this.elements(expression.expression, branch, budget);
    if (ts.isArrayLiteralExpression(expression))
      return expression.elements.flatMap((item) => this.elements(item, branch, budget));
    if (this.isRouter(expression)) return [expression];
    const declaration = constantDeclaration(expression, this.checker);
    if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer)
      return this.elements(declaration.initializer, branch, budget);
    return [expression];
  }

  private children(expression: ts.Expression): ts.Expression[] {
    return this.elements(expression).filter((item) => this.isRouter(item));
  }

  private middleware(expression: ts.Expression): boolean {
    return this.elements(expression).every(
      (item) => this.checker.getTypeAtLocation(item).getCallSignatures().length > 0,
    );
  }

  private isRouter(expression: ts.Expression): boolean {
    return (
      this.checker
        .getTypeAtLocation(expression)
        .getProperty('use')
        ?.declarations?.some((declaration) =>
          /[/\\]express-serve-static-core[/\\]/.test(declaration.getSourceFile().fileName),
        ) ?? false
    );
  }

  private identity(expression: ts.Expression, active = new Set<ts.Node>()): ts.Symbol | undefined {
    expression = unwrapExpression(expression);
    if (active.has(expression) || active.size >= 100)
      return sourceOf(expression).fail('Circular or excessive router aliases.');
    const branch = new Set(active).add(expression);
    const selected = constantProperty(expression, this.checker);
    if (selected) return this.identity(selected, branch);
    const receiver = this.fluentReceiver(expression);
    if (receiver) return this.identity(receiver, branch);
    let symbol = this.checker.getSymbolAtLocation(expression);
    if (symbol?.valueDeclaration && ts.isShorthandPropertyAssignment(symbol.valueDeclaration))
      symbol = this.checker.getShorthandAssignmentValueSymbol(symbol.valueDeclaration);
    if (symbol && symbol.flags & ts.SymbolFlags.Alias)
      symbol = this.checker.getAliasedSymbol(symbol);
    const declaration = symbol?.valueDeclaration;
    if (
      declaration &&
      ts.isVariableDeclaration(declaration) &&
      declaration.initializer &&
      ts.isVariableDeclarationList(declaration.parent) &&
      !(declaration.parent.flags & ts.NodeFlags.Const)
    )
      return sourceOf(expression).fail(
        'Router identities must use const bindings for static mount discovery.',
      );
    const initializer =
      declaration && ts.isVariableDeclaration(declaration) && declaration.initializer
        ? unwrapExpression(declaration.initializer)
        : undefined;
    if (
      initializer &&
      (ts.isIdentifier(initializer) ||
        ts.isPropertyAccessExpression(initializer) ||
        ts.isElementAccessExpression(initializer) ||
        this.fluentReceiver(initializer))
    )
      return this.identity(initializer, branch);
    return symbol;
  }

  private fluentReceiver(expression: ts.Expression): ts.Expression | undefined {
    if (!ts.isCallExpression(expression)) return undefined;
    const member = unwrapExpression(expression.expression);
    const receiver =
      ts.isPropertyAccessExpression(member) || ts.isElementAccessExpression(member)
        ? member.expression
        : undefined;
    if (!receiver || !this.isRouter(receiver)) return undefined;
    const name = ts.isPropertyAccessExpression(member)
      ? member.name.text
      : ts.isElementAccessExpression(member) && member.argumentExpression
        ? this.constants.read(member.argumentExpression)
        : undefined;
    return name && (name === 'use' || name === 'route' || expressMethod(name))
      ? receiver
      : undefined;
  }
}
