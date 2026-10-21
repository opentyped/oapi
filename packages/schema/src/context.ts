import ts from 'typescript';
import { SchemaError } from '~/error';
import { SchemaProjection } from '~/projection';
import type { AnnotationOrigin, TypeBindings } from '~/projection';

export interface AnnotationContext {
  readonly key: string;
  readonly bindings: TypeBindings;
}

/** Intern syntax provenance separately from TypeScript's erased value-type identity. */
export class SchemaContexts {
  readonly empty: AnnotationContext = { key: '', bindings: new Map() };
  private readonly contexts = new Map<string, AnnotationContext>();
  private readonly projection: SchemaProjection;
  private readonly instances = new WeakMap<ts.Type, Map<string, object>>();

  constructor(
    private readonly checker: ts.TypeChecker,
    root: string,
  ) {
    this.projection = new SchemaProjection(checker, root);
    this.contexts.set('', this.empty);
  }

  enter(type: ts.Type, node: ts.Node, parent: AnnotationContext): AnnotationContext {
    let syntax = this.syntax(node);
    let bindings = parent.bindings;
    const seen = new Set<ts.Declaration>();
    while (syntax) {
      if (ts.isParenthesizedTypeNode(syntax)) {
        syntax = syntax.type;
        continue;
      }
      if (ts.isIndexedAccessTypeNode(syntax)) {
        syntax = syntax.objectType;
        continue;
      }
      if (!(ts.isTypeReferenceNode(syntax) || ts.isImportTypeNode(syntax))) break;
      let symbol = this.checker.getSymbolAtLocation(
        ts.isTypeReferenceNode(syntax) ? syntax.typeName : (syntax.qualifier ?? syntax),
      );
      if (symbol?.flags && symbol.flags & ts.SymbolFlags.Alias)
        symbol = this.checker.getAliasedSymbol(symbol);
      const declaration = symbol?.declarations?.find(
        (item) =>
          ts.isTypeAliasDeclaration(item) ||
          ts.isInterfaceDeclaration(item) ||
          ts.isClassDeclaration(item),
      );
      if (!declaration || seen.has(declaration)) break;
      seen.add(declaration);
      bindings = this.projection.bind(syntax, declaration, bindings);
      const arguments_ =
        type.aliasSymbol === symbol
          ? type.aliasTypeArguments
          : type.getSymbol() === symbol &&
              type.flags & ts.TypeFlags.Object &&
              (type as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference
            ? this.checker.getTypeArguments(type as ts.TypeReference)
            : undefined;
      if (arguments_) {
        const concrete = new Map(bindings);
        declaration.typeParameters?.forEach((parameter, index) => {
          if (arguments_[index])
            concrete.set(this.checker.getTypeAtLocation(parameter), arguments_[index]);
        });
        bindings = Object.assign(concrete, { origins: bindings.origins });
      }
      if (declaration.getSourceFile().hasNoDefaultLib) {
        syntax =
          symbol && ['Readonly', 'Partial', 'Required', 'Pick', 'Omit'].includes(symbol.name)
            ? syntax.typeArguments?.[0]
            : undefined;
        continue;
      }
      if (!ts.isTypeAliasDeclaration(declaration)) {
        bindings = this.inherited(declaration, bindings);
        break;
      }
      syntax = declaration.type;
      if (
        (ts.isConditionalTypeNode(syntax) || ts.isMappedTypeNode(syntax)) &&
        this.projection.containsOrigins(syntax, bindings)
      ) {
        throw new SchemaError(
          'Annotated generic arguments through mapped or conditional aliases require explicit annotation origins',
          syntax,
        );
      }
    }
    const entries = [...(bindings.origins ?? [])].map(([parameter, origin]) => {
      const declaration = parameter.getSymbol()?.declarations?.[0];
      if (!declaration)
        throw new SchemaError('Generic annotation parameter has no declaration identity', node);
      return [this.projection.declarationKey(declaration), origin.key];
    });
    if (!entries.length) return bindings.size ? { key: '', bindings } : this.empty;
    entries.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
    const key = JSON.stringify(entries);
    const existing = this.contexts.get(key);
    if (existing) return existing;
    const context = { key, bindings };
    this.contexts.set(key, context);
    return context;
  }

  instance(type: ts.Type, context: AnnotationContext): object {
    let contexts = this.instances.get(type);
    if (!contexts) {
      contexts = new Map();
      this.instances.set(type, contexts);
    }
    let instance = contexts.get(context.key);
    if (!instance) {
      instance = { type, context };
      contexts.set(context.key, instance);
    }
    return instance;
  }

  origin(syntax: ts.TypeNode, context: AnnotationContext): AnnotationOrigin | undefined {
    return context.bindings.origins?.get(this.checker.getTypeFromTypeNode(syntax));
  }

  private inherited(
    declaration: ts.InterfaceDeclaration | ts.ClassDeclaration,
    bindings: TypeBindings,
    seen = new Set<ts.Declaration>(),
  ): TypeBindings {
    if (seen.has(declaration)) return bindings;
    seen.add(declaration);
    for (const clause of declaration.heritageClauses ?? []) {
      for (const base of clause.types) {
        let symbol = this.checker.getSymbolAtLocation(base.expression);
        if (symbol?.flags && symbol.flags & ts.SymbolFlags.Alias)
          symbol = this.checker.getAliasedSymbol(symbol);
        const target = symbol?.declarations?.find(
          (item) => ts.isInterfaceDeclaration(item) || ts.isClassDeclaration(item),
        );
        if (target)
          bindings = this.inherited(target, this.projection.bind(base, target, bindings), seen);
      }
    }
    return bindings;
  }

  private syntax(node: ts.Node): ts.TypeNode | undefined {
    if (ts.isTypeNode(node)) return node;
    if (
      ts.isTypeAliasDeclaration(node) ||
      ts.isPropertySignature(node) ||
      ts.isPropertyDeclaration(node) ||
      ts.isParameter(node)
    )
      return node.type;
    return undefined;
  }
}
