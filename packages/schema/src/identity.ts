import fs from 'node:fs';
import { nodeNames } from '@opentyped/ast/nodes';
import ts from 'typescript';
import { documentationOf } from '@opentyped/ast/jsdoc';
import { SchemaError } from '~/error';
import { SchemaNamespace } from '~/namespace';

export class SchemaIdentity {
  private readonly names = new Map<ts.Type, Map<string, string>>();
  private readonly owners = new Map<string, { type: ts.Type; context: string }>();

  private readonly namespace: SchemaNamespace;

  constructor(
    private readonly checker: ts.TypeChecker,
    root: string,
    namespaces?: Readonly<Record<string, string>>,
    private readonly naming?: (node: ts.Node) => string | undefined,
    private readonly generatedName?: (preferred: string) => string,
    private readonly sourceNamespace?: (node: ts.Node) => string | undefined,
  ) {
    this.namespace = new SchemaNamespace(root, namespaces);
  }

  private scope(node: ts.Node): string {
    return this.sourceNamespace?.(node) ?? this.namespace.scope(node.getSourceFile().fileName);
  }

  reserve(type: ts.Type, name: string, node: ts.Node, context = ''): string {
    const existing = this.names.get(type)?.get(context);
    if (existing) return existing;
    const owner = this.owners.get(name);
    if (owner && (owner.context !== context || !this.same(owner.type, type))) {
      throw new SchemaError(`Schema name '${name}' belongs to more than one type`, node);
    }
    const names = this.names.get(type) ?? new Map<string, string>();
    names.set(context, name);
    this.names.set(type, names);
    this.owners.set(name, { type, context });
    return name;
  }

  sameDeclaration(left: ts.Node, right: ts.Node): boolean {
    if (left === right) return true;
    const symbol = (node: ts.Node): ts.Symbol | undefined =>
      (ts.isInterfaceDeclaration(node) ||
        ts.isTypeAliasDeclaration(node) ||
        ts.isClassDeclaration(node) ||
        ts.isEnumDeclaration(node)) &&
      node.name
        ? this.checker.getSymbolAtLocation(node.name)
        : undefined;
    const owner = symbol(left);
    if (owner && owner === symbol(right)) return true;
    return (
      left.pos === right.pos &&
      left.end === right.end &&
      fs.realpathSync(left.getSourceFile().fileName) ===
        fs.realpathSync(right.getSourceFile().fileName)
    );
  }

  same(left: ts.Type, right: ts.Type): boolean {
    return (
      left === right ||
      this.physicalDeclaration(left) === this.physicalDeclaration(right) ||
      (this.transparentAlias(left) &&
        this.transparentAlias(right) &&
        this.sameInstantiation(left, right)) ||
      (left.isIntersection() &&
        right.isIntersection() &&
        (!left.aliasSymbol || !right.aliasSymbol) &&
        left.types.length === right.types.length &&
        left.types.every((part) => right.types.includes(part)))
    );
  }

  private physicalDeclaration(type: ts.Type): string | ts.Type {
    const declaration = (type.aliasSymbol ?? type.getSymbol())?.declarations?.find(
      (node) =>
        ts.isInterfaceDeclaration(node) ||
        ts.isTypeAliasDeclaration(node) ||
        ts.isClassDeclaration(node) ||
        ts.isEnumDeclaration(node),
    );
    if (!declaration) return type;
    return `${fs.realpathSync(declaration.getSourceFile().fileName)}:${declaration.pos}:${this.checker.typeToString(type, declaration, ts.TypeFormatFlags.NoTruncation)}`;
  }

  declaration(symbol: ts.Symbol, declaration: ts.Node): string {
    if (symbol.getJsDocTags(this.checker).some((tag) => tag.name === 'namespace')) {
      throw new SchemaError(
        '@namespace is unsupported; configure SchemaOptions.namespaces instead',
        declaration,
      );
    }
    const provided = this.naming?.(declaration);
    if (provided !== undefined) {
      if (!provided.trim()) throw new SchemaError('Schema names must be nonempty', declaration);
      return provided;
    }
    const labels = ts.getJSDocTags(declaration).filter((tag) => tag.tagName.text === 'schemaName');
    if (labels.length > 1) throw new SchemaError('Duplicate @schemaName annotation', declaration);
    if (labels[0]) {
      const label = ts.getTextOfJSDocComment(labels[0].comment)?.trim();
      if (!label) throw new SchemaError('@schemaName requires a name', labels[0]);
      return label;
    }
    const scope = this.scope(declaration);
    const namespaces: string[] = [];
    for (let parent = declaration.parent; parent; parent = parent.parent) {
      if (ts.isModuleDeclaration(parent)) namespaces.unshift(parent.name.text);
    }
    return [scope, ...namespaces, symbol.name].join('.');
  }

  /** Public checker instantiations can differ by identity at a recursive mapped edge. */
  private sameInstantiation(
    left: ts.Type,
    right: ts.Type,
    seen = new Map<ts.Type, Set<ts.Type>>(),
  ): boolean {
    if (left === right) return true;
    const reference = (type: ts.Type): type is ts.TypeReference =>
      !!(type.flags & ts.TypeFlags.Object) &&
      !!((type as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference);
    const symbolOf = (type: ts.Type): ts.Symbol | undefined =>
      reference(type) ? type.getSymbol() : (type.aliasSymbol ?? type.getSymbol());
    const symbol = symbolOf(left);
    if (!symbol || symbol !== symbolOf(right)) return false;
    const argumentsOf = (type: ts.Type): readonly ts.Type[] =>
      reference(type) ? this.checker.getTypeArguments(type) : (type.aliasTypeArguments ?? []);
    const a = argumentsOf(left);
    const b = argumentsOf(right);
    if (!a.length || a.length !== b.length) return false;
    if (seen.get(left)?.has(right)) return true;
    const pairs = seen.get(left) ?? new Set<ts.Type>();
    pairs.add(right);
    seen.set(left, pairs);
    return a.every((argument, index) => this.sameInstantiation(argument, b[index]!, seen));
  }

  name(
    type: ts.Type,
    node: ts.Node,
    context = '',
    origins: readonly ts.Node[] = [],
  ): string | undefined {
    const existing = this.names.get(type)?.get(context);
    if (existing) return existing;
    if (type.isIntersection() && !type.aliasSymbol) {
      for (const [name, owner] of this.owners)
        if (
          owner.context === context &&
          this.transparentAlias(owner.type) &&
          this.same(owner.type, type)
        )
          return this.reserve(type, name, node, context);
    }
    if (
      type.flags & ts.TypeFlags.Object &&
      (type as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference &&
      this.checker.getTypeArguments(type as ts.TypeReference).length &&
      this.transparentAlias(type)
    )
      for (const [name, owner] of this.owners)
        if (
          owner.context === context &&
          this.transparentAlias(owner.type) &&
          this.sameInstantiation(owner.type, type)
        )
          return this.reserve(type, name, node, context);
    const symbol = type.aliasSymbol ?? type.getSymbol();
    const declaration = symbol?.declarations?.find(
      (item) =>
        ts.isInterfaceDeclaration(item) ||
        ts.isTypeAliasDeclaration(item) ||
        ts.isClassDeclaration(item) ||
        ts.isEnumDeclaration(item),
    );
    if (!symbol || !declaration) return undefined;
    const builtin = declaration.getSourceFile().hasNoDefaultLib;
    if (builtin) {
      if (
        type.flags & ts.TypeFlags.Object &&
        (type as ts.ObjectType).objectFlags & ts.ObjectFlags.Mapped
      ) {
        for (const [name, owner] of this.owners)
          if (owner.context === context && this.sameInstantiation(owner.type, type))
            return this.reserve(type, name, node, context);
      }
      if (symbol.name !== 'Readonly') return undefined;
    }
    const base = builtin ? symbol.name : this.declaration(symbol, declaration);
    const arguments_ =
      type.aliasTypeArguments ??
      (type.flags & ts.TypeFlags.Object &&
      (type as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference
        ? this.checker.getTypeArguments(type as ts.TypeReference)
        : []);
    const parameters = arguments_.length
      ? `<${arguments_.map((argument) => this.argumentName(argument, node)).join(',')}>`
      : '';
    const specialization = context ? this.specialization(origins.length ? origins : [node]) : '';
    const preferred = `${base}${parameters}${specialization}`;
    const name =
      parameters || specialization ? (this.generatedName?.(preferred) ?? preferred) : preferred;
    return this.reserve(type, name, node, context);
  }

  private transparentAlias(type: ts.Type): boolean {
    let symbol = type.aliasSymbol;
    const seen = new Set<ts.Symbol>();
    while (symbol && !seen.has(symbol)) {
      seen.add(symbol);
      const declarations = symbol.declarations ?? [];
      if (
        declarations.some(
          (declaration) =>
            !declaration.getSourceFile().hasNoDefaultLib &&
            (documentationOf(declaration) ||
              ts
                .getJSDocTags(declaration)
                .some((tag) => !['schema', 'schemaName'].includes(tag.tagName.text))),
        )
      )
        return false;
      let syntax = declarations.find(ts.isTypeAliasDeclaration)?.type;
      while (syntax && ts.isParenthesizedTypeNode(syntax)) syntax = syntax.type;
      symbol =
        syntax && (ts.isTypeReferenceNode(syntax) || ts.isImportTypeNode(syntax))
          ? this.checker.getSymbolAtLocation(
              ts.isTypeReferenceNode(syntax) ? syntax.typeName : (syntax.qualifier ?? syntax),
            )
          : undefined;
      if (symbol?.flags && symbol.flags & ts.SymbolFlags.Alias)
        symbol = this.checker.getAliasedSymbol(symbol);
    }
    return true;
  }

  recursive(
    type: ts.Type,
    node: ts.Node,
    context: string,
    origins: readonly ts.Node[] = [],
  ): string {
    const scope = this.scope(node);
    const path = nodeNames(node);
    const specialization = context ? this.specialization(origins.length ? origins : [node]) : '';
    const preferred = path.length
      ? `${scope}.${path.join('.')}${specialization}`
      : `${scope}.${this.argumentName(type, node)}${specialization}`;
    return this.reserve(type, this.generatedName?.(preferred) ?? preferred, node, context);
  }

  private specialization(origins: readonly ts.Node[]): string {
    const names = origins.map((node) => {
      const path = nodeNames(node);
      if (ts.isTypeReferenceNode(node)) path.push(node.typeName.getText());
      else if (ts.isTypeQueryNode(node)) path.push(node.exprName.getText());
      else if (ts.isImportTypeNode(node) && node.qualifier) path.push(node.qualifier.getText());
      if (!path.length)
        throw new SchemaError(
          'Cannot name this schema specialization. Introduce a named type alias.',
          node,
        );
      return [this.scope(node), ...path].join('.');
    });
    return `.From.${[...new Set(names)].sort().join('.And.')}`;
  }

  private argumentName(type: ts.Type, node: ts.Node, seen = new Set<ts.Type>()): string {
    const named = this.name(type, node);
    if (named) return named;
    const declaration = (type.aliasSymbol ?? type.getSymbol())?.declarations?.find(
      (item) => !item.getSourceFile().hasNoDefaultLib && nodeNames(item).length,
    );
    if (declaration) {
      const path = nodeNames(declaration);
      const parent = declaration.parent;
      if (ts.isTypeReferenceNode(parent) && (parent.typeArguments?.length ?? 0) > 1) {
        const index = parent.typeArguments!.findIndex(
          (argument) => argument === (declaration as ts.Node),
        );
        const target = this.checker.getTypeAtLocation(parent);
        const owner = (target.aliasSymbol ?? target.getSymbol())?.declarations?.find(
          (item) => ts.isInterfaceDeclaration(item) || ts.isTypeAliasDeclaration(item),
        );
        const parameter = owner?.typeParameters?.[index];
        if (parameter) path.push(parameter.name.text);
      }
      return [this.scope(declaration), ...path].join('.');
    }
    const fallback = this.checker
      .typeToString(type, node, ts.TypeFormatFlags.NoTruncation)
      .replace(/\bimport\("((?:[^"\\]|\\.)*)"\)/g, (_match, file: string) => {
        const module = JSON.parse(`"${file}"`) as string;
        const source =
          [module, ...['.ts', '.tsx', '.mts', '.cts'].map((ext) => module + ext)].find(
            (candidate) => fs.existsSync(candidate),
          ) ?? module;
        return this.namespace.scope(source);
      });
    if (seen.has(type)) return fallback;
    seen.add(type);
    const symbol = type.aliasSymbol ?? type.getSymbol();
    const arguments_ =
      type.aliasTypeArguments ??
      (type.flags & ts.TypeFlags.Object &&
      (type as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference
        ? this.checker.getTypeArguments(type as ts.TypeReference)
        : []);
    if (
      !arguments_?.length ||
      !symbol?.declarations?.every((declaration) => declaration.getSourceFile().hasNoDefaultLib)
    )
      return fallback;
    return `${symbol.name}<${arguments_.map((argument) => this.argumentName(argument, node, new Set(seen))).join(',')}>`;
  }
}
