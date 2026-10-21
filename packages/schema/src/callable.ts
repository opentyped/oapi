import ts from 'typescript';
import { annotate } from '~/annotation';
import type { Schema } from '~/definition';
import { SchemaError } from '~/error';
import { SchemaProjection } from '~/projection';
import type { TypeBindings } from '~/projection';
import { tupleItem } from '~/tuple';

const utilities = new Set([
  'ReturnType',
  'InstanceType',
  'ThisParameterType',
  'Parameters',
  'ConstructorParameters',
]);

type Encode = (type: ts.Type, node: ts.Node) => Schema;
type Expression = (
  value: Schema,
  syntax: ts.TypeNode,
  checked: ts.Type | undefined,
  bindings: TypeBindings,
) => Schema;

/** Recover callable utility origins through public checker signatures. */
export class SchemaCallable {
  private readonly projection: SchemaProjection;

  constructor(
    private readonly checker: ts.TypeChecker,
    private readonly encode: Encode,
    private readonly expression: Expression,
    root: string,
  ) {
    this.projection = new SchemaProjection(checker, root);
  }

  resolve(
    syntax: ts.TypeNode,
    bindings: TypeBindings,
    kind = ts.SignatureKind.Call,
  ): { signature: ts.Signature; bindings: TypeBindings } {
    const active = new Set<ts.Node>();
    while (!active.has(syntax)) {
      active.add(syntax);
      if (ts.isParenthesizedTypeNode(syntax)) {
        syntax = syntax.type;
        continue;
      }
      const origin = bindings.origins?.get(this.checker.getTypeFromTypeNode(syntax));
      if (origin) {
        syntax = origin.syntax;
        bindings = origin.bindings;
        continue;
      }
      if (ts.isTypeReferenceNode(syntax) || ts.isImportTypeNode(syntax)) {
        let symbol = this.checker.getSymbolAtLocation(
          ts.isTypeReferenceNode(syntax) ? syntax.typeName : (syntax.qualifier ?? syntax),
        );
        if (symbol?.flags && symbol.flags & ts.SymbolFlags.Alias)
          symbol = this.checker.getAliasedSymbol(symbol);
        const declaration = symbol?.declarations?.find(ts.isTypeAliasDeclaration);
        if (declaration && !declaration.getSourceFile().hasNoDefaultLib) {
          bindings = this.projection.bind(syntax, declaration, bindings);
          syntax = declaration.type;
          continue;
        }
      }
      break;
    }
    const type = this.projection.resolved(this.checker.getTypeFromTypeNode(syntax), bindings);
    const signature = this.checker.getSignaturesOfType(type, kind).at(-1);
    if (!signature) throw new SchemaError('Callable annotation origin cannot be resolved', syntax);
    return { signature, bindings };
  }

  /** Resolve the object selected by a callable utility before reading its property origins. */
  selectedType(
    syntax: ts.TypeNode,
    bindings: TypeBindings,
  ): { type: ts.Type; bindings: TypeBindings; node?: ts.Node } | undefined {
    const utility = ts.isIndexedAccessTypeNode(syntax) ? syntax.objectType : syntax;
    if (!ts.isTypeReferenceNode(utility) || !utility.typeArguments?.[0]) return undefined;
    let symbol = this.checker.getSymbolAtLocation(utility.typeName);
    if (symbol?.flags && symbol.flags & ts.SymbolFlags.Alias)
      symbol = this.checker.getAliasedSymbol(symbol);
    if (!symbol?.declarations?.every((node) => node.getSourceFile().hasNoDefaultLib))
      return undefined;
    const name = symbol.name;
    if (!utilities.has(name)) return undefined;
    if (this.opaque(syntax, bindings)) return undefined;
    const source = this.resolve(
      utility.typeArguments[0],
      bindings,
      ['InstanceType', 'ConstructorParameters'].includes(name)
        ? ts.SignatureKind.Construct
        : ts.SignatureKind.Call,
    );
    let type: ts.Type;
    let node: ts.Node | undefined;
    if (ts.isIndexedAccessTypeNode(syntax)) {
      if (!['Parameters', 'ConstructorParameters'].includes(name)) return undefined;
      const key = this.projection.resolved(
        this.checker.getTypeFromTypeNode(syntax.indexType),
        bindings,
      );
      if (!key.isNumberLiteral() || !Number.isSafeInteger(key.value) || key.value < 0)
        return undefined;
      const parameter = source.signature.parameters[key.value];
      const declaration = parameter?.valueDeclaration ?? parameter?.declarations?.[0];
      if (!parameter || !declaration) return undefined;
      if (ts.isParameter(declaration) && declaration.dotDotDotToken) return undefined;
      node = declaration;
      type = this.checker.getTypeOfSymbolAtLocation(parameter, declaration);
    } else if (name === 'ReturnType' || name === 'InstanceType') {
      type = this.checker.getReturnTypeOfSignature(source.signature);
      node = source.signature.getDeclaration()?.type;
    } else if (name === 'ThisParameterType') {
      const parameter = source.signature.thisParameter;
      const declaration = parameter?.valueDeclaration ?? parameter?.declarations?.[0];
      if (!parameter || !declaration) return undefined;
      node = declaration;
      type = this.checker.getTypeOfSymbolAtLocation(parameter, declaration);
    } else return undefined;
    type = this.projection.resolved(type, source.bindings);
    if (type.flags & ts.TypeFlags.TypeParameter)
      type = this.checker.getBaseConstraintOfType(type) ?? type;
    return { type, bindings: source.bindings, ...(node ? { node } : {}) };
  }

  /** Type policy is checked by generation; an opaque source has no signature metadata to recover. */
  opaque(syntax: ts.TypeNode, bindings: TypeBindings): boolean {
    const utility = ts.isIndexedAccessTypeNode(syntax) ? syntax.objectType : syntax;
    if (!ts.isTypeReferenceNode(utility) || !utility.typeArguments?.[0]) return false;
    let symbol = this.checker.getSymbolAtLocation(utility.typeName);
    if (symbol?.flags && symbol.flags & ts.SymbolFlags.Alias)
      symbol = this.checker.getAliasedSymbol(symbol);
    if (
      !symbol?.declarations?.every((node) => node.getSourceFile().hasNoDefaultLib) ||
      !utilities.has(symbol.name)
    )
      return false;
    const input = utility.typeArguments[0];
    const type = this.projection.resolved(this.checker.getTypeFromTypeNode(input), bindings);
    if (!(type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown))) return false;
    if (this.projection.containsOrigins(input, bindings))
      throw new SchemaError('Opaque callable annotations require an explicit wire schema', input);
    return true;
  }

  parameters(
    syntax: ts.TypeReferenceNode | ts.ImportTypeNode,
    checked: ts.Type,
    bindings: TypeBindings,
    kind = ts.SignatureKind.Call,
  ): Schema {
    const source = this.resolve(syntax.typeArguments![0]!, bindings, kind);
    if (!this.checker.isTupleType(checked))
      throw new SchemaError('Parameter annotation provenance requires a resolved tuple', syntax);
    const types = this.checker.getTypeArguments(checked as ts.TypeReference);
    const flags = (checked as ts.TupleTypeReference).target.elementFlags;
    const prefixItems: Schema[] = [];
    let items: Schema = false;
    let minItems = 0;
    source.signature.parameters.forEach((parameter, index) => {
      const declaration = parameter.valueDeclaration ?? parameter.declarations?.[0];
      const type = types[index];
      if (!declaration || !ts.isParameter(declaration) || !type)
        throw new SchemaError('Parameter annotation origin cannot be resolved', syntax);
      let origin = declaration.type;
      const flag = flags[index] ?? ts.ElementFlags.Required;
      if (!origin && this.annotatedSyntax(declaration, source.bindings))
        throw new SchemaError(
          'Inferred parameter annotations require an explicit parameter type',
          declaration,
        );
      if (flag & (ts.ElementFlags.Rest | ts.ElementFlags.Variadic)) {
        if (
          flag & ts.ElementFlags.Variadic ||
          index !== types.length - 1 ||
          !origin ||
          !ts.isArrayTypeNode(origin)
        )
          throw new SchemaError(
            'Annotated parameter rest requires explicit array syntax',
            declaration,
          );
        origin = origin.elementType;
        items = tupleItem(
          this.expression(this.encode(type, origin), origin, type, source.bindings),
          declaration,
        );
      } else {
        const variants =
          type.isUnion() && flag & ts.ElementFlags.Optional
            ? type.types.filter((part) => !(part.flags & ts.TypeFlags.Undefined))
            : [type];
        const schemas = variants.map((part) =>
          origin
            ? this.expression(this.encode(part, origin), origin, part, source.bindings)
            : this.encode(part, declaration),
        );
        const schema = schemas.length === 1 ? schemas[0]! : { anyOf: schemas };
        prefixItems.push(annotate(tupleItem(schema, declaration), declaration));
        if (flag & ts.ElementFlags.Required) minItems = index + 1;
      }
    });
    return {
      type: 'array',
      ...(prefixItems.length ? { prefixItems } : {}),
      items,
      minItems,
      ...(items === false ? { maxItems: prefixItems.length } : {}),
    };
  }

  receiver(syntax: ts.TypeNode, checked: ts.Type, bindings: TypeBindings): Schema {
    const source = this.resolve(syntax, bindings);
    const parameter = source.signature.thisParameter;
    const declaration = parameter?.valueDeclaration ?? parameter?.declarations?.[0];
    if (!declaration || !ts.isParameter(declaration) || !declaration.type)
      throw new SchemaError(
        'Receiver annotation origin requires an explicit this parameter',
        syntax,
      );
    return annotate(
      this.expression(
        this.encode(checked, declaration.type),
        declaration.type,
        checked,
        source.bindings,
      ),
      declaration,
    );
  }

  returnType(value: Schema, syntax: ts.TypeNode, checked: ts.Type, bindings: TypeBindings): Schema {
    const source = this.resolve(syntax, bindings);
    const origin = source.signature.getDeclaration();
    if (origin?.type) return this.expression(value, origin.type, checked, source.bindings);
    if (origin && this.annotatedSyntax(origin, source.bindings))
      throw new SchemaError(
        'Inferred return annotation origins require an explicit return type',
        origin,
      );
    return value;
  }

  awaited(
    value: Schema,
    syntax: ts.TypeNode,
    actual: ts.Type,
    bindings: TypeBindings,
    active = new Set<ts.Node>(),
  ): Schema {
    if (active.has(syntax)) throw new SchemaError('Awaited annotation origin is recursive', syntax);
    active.add(syntax);
    try {
      if (ts.isParenthesizedTypeNode(syntax))
        return this.awaited(value, syntax.type, actual, bindings, active);
      const origin = bindings.origins?.get(this.checker.getTypeFromTypeNode(syntax));
      if (origin) return this.awaited(value, origin.syntax, actual, origin.bindings, active);
      if (ts.isTypeReferenceNode(syntax) || ts.isImportTypeNode(syntax)) {
        let symbol = this.checker.getSymbolAtLocation(
          ts.isTypeReferenceNode(syntax) ? syntax.typeName : (syntax.qualifier ?? syntax),
        );
        if (symbol?.flags && symbol.flags & ts.SymbolFlags.Alias)
          symbol = this.checker.getAliasedSymbol(symbol);
        const declaration = symbol?.declarations?.[0];
        if (
          declaration?.getSourceFile().hasNoDefaultLib &&
          ['Promise', 'PromiseLike', 'Awaited'].includes(symbol?.name ?? '') &&
          syntax.typeArguments?.[0]
        )
          return this.awaited(value, syntax.typeArguments[0], actual, bindings, active);
        if (
          declaration?.getSourceFile().hasNoDefaultLib &&
          symbol?.name === 'ReturnType' &&
          syntax.typeArguments?.[0]
        ) {
          const source = this.resolve(syntax.typeArguments[0], bindings);
          const declaration = source.signature.getDeclaration();
          if (declaration?.type)
            return this.awaited(value, declaration.type, actual, source.bindings, active);
          if (declaration && this.annotatedSyntax(declaration, source.bindings))
            throw new SchemaError(
              'Inferred awaited return annotations require an explicit return type',
              declaration,
            );
          return value;
        }
        if (
          declaration &&
          !declaration.getSourceFile().hasNoDefaultLib &&
          ts.isTypeAliasDeclaration(declaration)
        ) {
          return annotate(
            this.awaited(
              value,
              declaration.type,
              actual,
              this.projection.bind(syntax, declaration, bindings),
              active,
            ),
            declaration,
          );
        }
      }
      const source = this.projection.resolved(this.checker.getTypeFromTypeNode(syntax), bindings);
      if (
        this.checker.getAwaitedType(source) !== source &&
        this.projection.containsOrigins(syntax, bindings)
      )
        throw new SchemaError(
          'Annotated thenable origins require an explicit awaited model',
          syntax,
        );
      return this.expression(value, syntax, actual, bindings);
    } finally {
      active.delete(syntax);
    }
  }
  private annotatedSyntax(node: ts.Node, bindings: TypeBindings): boolean {
    return ts.isTypeNode(node)
      ? this.projection.containsOrigins(node, bindings)
      : Boolean(ts.forEachChild(node, (child) => this.annotatedSyntax(child, bindings)));
  }
}
