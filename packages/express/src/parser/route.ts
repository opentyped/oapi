import ts from 'typescript';
import { METHODS } from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { parse, match } from 'path-to-regexp';
import type { Token } from 'path-to-regexp';
import type { Source } from '@typedapi/openapi/diagnostic';
import { ConstantString, constantDeclaration, constantProperty } from '@typedapi/ast/constant';
import { ConstantJson } from '@typedapi/ast/json';
import { sourceOf } from '@typedapi/ast/diagnostic';
import { unwrapExpression } from '@typedapi/ast/navigation';

const methods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD', 'TRACE']);

const registrationMethods = new Set([...METHODS, 'QUERY']);

export function expressMethod(name: string): boolean {
  return name === 'all' || registrationMethods.has(name.toUpperCase());
}

function expressVersion(file: string | undefined, source: Source): string | undefined {
  if (!file) return undefined;
  let manifest: string;
  try {
    manifest = createRequire(file).resolve('express/package.json');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'MODULE_NOT_FOUND') return undefined;
    return source.fail(`Cannot resolve the Express version for ${file}: ${String(error)}`);
  }
  return (JSON.parse(readFileSync(manifest, 'utf8')) as { version?: string }).version;
}

/** Normalize only path tokens that OpenAPI can describe without changing route reachability. */
export function openApiPaths(path: string, source: Source, file?: string): string[] {
  let normalized = path;
  if (path.includes('?') && expressVersion(file, source)?.startsWith('4.')) {
    // A single trailing optional segment has two unambiguous path variants.
    if (!/^\/(?:[A-Za-z0-9_.~-]+\/|:\w+\/)*:\w+\?$/.test(path))
      return source.fail('Express 4 optional paths require one trailing /:name? segment.');
    normalized = path.replace(/\/:([A-Za-z0-9_]+)\?$/, '{/:$1}');
  }
  let tokens: Token[];
  try {
    tokens = parse(normalized).tokens;
  } catch (error) {
    return source.fail(
      `Cannot parse Express path ${path}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const modern =
    /[{}"$^|\\]/.test(path) ||
    tokens.some((token) => token.type === 'param' && !/^\w+$/.test(token.name));
  if (modern && expressVersion(file, source)?.startsWith('4.'))
    return source.fail(
      `Express 4 path ${path} cannot use Express 5 normalization. Use ordinary literal segments and unquoted ASCII parameter names, or document this route explicitly.`,
    );
  const expand = (tokens: Token[], depth = 0): string[] => {
    if (depth >= 100) return source.fail('Express optional groups exceed 100 nesting levels.');
    let paths = [''];
    for (const token of tokens) {
      let values: string[];
      if (token.type === 'group') values = [...new Set(['', ...expand(token.tokens, depth + 1)])];
      else if (token.type === 'text' && !/[?#*{}]/.test(token.value)) values = [token.value];
      else if (token.type === 'param' && /^[\p{ID_Continue}$.-]+$/u.test(token.name))
        values = [`{${token.name}}`];
      else
        return source.fail(
          `Unsupported Express path syntax in ${path}. Wildcards and reserved literal characters require explicit route documentation.`,
        );
      if (paths.length * values.length > 1000)
        return source.fail('Express optional groups expand beyond 1000 paths.');
      paths = [...new Set(paths.flatMap((prefix) => values.map((value) => prefix + value)))];
    }
    return paths;
  };
  return expand(tokens).map((value) => value || '/');
}

/** One Express layer tries only its first matching array alternative. */
export function validateMountPaths(paths: string[], source: Source): void {
  if (paths.length < 2) return;
  const patterns = paths.map((path) => {
    const tokens = parse(path).tokens;
    let prefix = '';
    let fixed = true;
    for (const token of tokens) {
      if (token.type !== 'text') {
        fixed = false;
        break;
      }
      prefix += token.value;
    }
    const starts = new RegExp('^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    return { prefix, fixed, starts, matches: match(path, { end: false, decode: false }) };
  });
  for (let index = 0; index < patterns.length; index++) {
    const left = patterns[index]!;
    for (const right of patterns.slice(index + 1)) {
      const overlap =
        left.fixed || right.fixed
          ? left.matches(right.prefix) || right.matches(left.prefix)
          : left.starts.test(right.prefix) || right.starts.test(left.prefix);
      if (overlap)
        source.fail(
          'Potentially overlapping router mount alternatives require separate use() calls; Express only tries the first matching prefix in an array.',
        );
    }
  }
}

/** Shared static path syntax for Express registrations and router mounts. */
export function expressPaths(expression: ts.Expression, checker: ts.TypeChecker): string[] {
  const value = new ConstantJson(checker).read(expression);
  const paths = Array.isArray(value) ? value : [value];
  if (!paths.length || paths.length > 1000 || !paths.every((path) => typeof path === 'string'))
    return sourceOf(expression).fail(
      'Express registration requires a string or 1–1000 static string paths.',
    );
  return [...new Set(paths)];
}

/** Resolves direct registrations and Express's shared-path Route builder chains. */
export class ExpressRegistration {
  private readonly constants: ConstantString;
  constructor(
    private readonly checker: ts.TypeChecker,
    private readonly additionalMethods = false,
  ) {
    this.constants = new ConstantString(checker);
  }

  read(wrapper: ts.CallExpression): { methods: string[]; paths: string[] } {
    const source = sourceOf(wrapper);
    const registration = this.registration(wrapper);
    const member = this.member(registration.expression);
    if (!member || !expressMethod(member.name))
      return source.fail('The handler wrapper requires a supported HTTP registration method.');
    const route = this.sharedPath(member.receiver, new Set())?.path ?? registration.arguments[0];
    if (!route || route === wrapper)
      return source.fail('Handler registration requires a static path.');
    return {
      methods:
        member.name === 'all'
          ? [...(this.additionalMethods ? registrationMethods : methods)]
          : [member.name.toUpperCase()],
      paths: expressPaths(route, this.checker),
    };
  }

  target(wrapper: ts.CallExpression): ts.Expression {
    const registration = this.registration(wrapper);
    const member = this.member(registration.expression)!;
    return this.sharedPath(member.receiver, new Set())?.target ?? member.receiver;
  }

  private registration(wrapper: ts.CallExpression): ts.CallExpression {
    let argument: ts.Node = wrapper;
    let depth = 0;
    while (
      ts.isArrayLiteralExpression(argument.parent) ||
      ts.isParenthesizedExpression(argument.parent) ||
      ts.isAsExpression(argument.parent) ||
      ts.isTypeAssertionExpression(argument.parent) ||
      ts.isSatisfiesExpression(argument.parent) ||
      ts.isNonNullExpression(argument.parent)
    ) {
      if (++depth > 100)
        return sourceOf(wrapper).fail('Express middleware nesting exceeds 100 levels.');
      argument = argument.parent;
    }
    const registration = argument.parent;
    if (
      !ts.isCallExpression(registration) ||
      !registration.arguments.some((item) => item === argument)
    )
      return sourceOf(wrapper).fail(
        'Place oapi.handler in an app/router HTTP registration or its middleware array.',
      );
    return registration;
  }

  private member(expression: ts.Expression): { name: string; receiver: ts.Expression } | undefined {
    expression = unwrapExpression(expression);
    if (ts.isPropertyAccessExpression(expression))
      return { name: expression.name.text, receiver: expression.expression };
    if (ts.isElementAccessExpression(expression) && expression.argumentExpression)
      return {
        name: this.constants.read(expression.argumentExpression),
        receiver: expression.expression,
      };
    return undefined;
  }

  private sharedPath(
    expression: ts.Expression,
    active: Set<ts.Node>,
  ): { path: ts.Expression; target: ts.Expression } | undefined {
    expression = unwrapExpression(expression);
    const source = sourceOf(expression);
    if (active.has(expression)) return source.fail('Circular Express route builder reference.');
    if (active.size >= 100) return source.fail('Express route builder exceeds 100 levels.');
    const branch = new Set(active).add(expression);
    const selected = constantProperty(expression, this.checker);
    if (selected) return this.sharedPath(selected, branch);
    const declaration = constantDeclaration(expression, this.checker);
    if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer)
      return this.sharedPath(declaration.initializer, branch);
    if (!ts.isCallExpression(expression)) return undefined;
    const member = this.member(expression.expression);
    if (!member) return undefined;
    if (member.name === 'route') {
      const path = expression.arguments[0];
      if (!path) return source.fail('Express route() requires a static path.');
      return { path, target: member.receiver };
    }
    if (expressMethod(member.name)) return this.sharedPath(member.receiver, branch);
    return undefined;
  }
}
