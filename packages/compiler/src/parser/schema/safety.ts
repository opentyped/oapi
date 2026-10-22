import { separateIndexes, indexPattern, templatePattern } from '@opentyped/ast/pattern';
import { annotationsOf } from '~/parser/annotation';
import ts from 'typescript';
import {
  isIntrinsicAnyType,
  isIntrinsicUnknownType,
  isTupleTypeReference,
  isTypeFlagSet,
} from 'ts-api-utils';
import { fail } from '@opentyped/ast/diagnostic';
import {
  builtInName,
  propertiesOf,
  tupleElementsOf,
  typeNodeOf,
  identityMapping,
  mutabilitySource,
  unwrapNoInfer,
  unwrapType,
} from '@opentyped/ast/navigation';

export interface TypePolicy {
  any?: 'error' | 'allow';
  unknown?: 'error' | 'allow';
}

/** Checks the resolved graph: aliases and generic substitutions cannot hide unsafe values. */
export class TypeSafety {
  private readonly seen = new Set<ts.Type>();
  private readonly reported = new Set<string>();
  readonly warnings: string[] = [];

  constructor(
    private readonly checker: ts.TypeChecker,
    private readonly policy: TypePolicy = {},
    private readonly mapped: (type: ts.Type) => boolean = () => false,
  ) {}

  private unconstrained(kind: 'any' | 'unknown', node: ts.Node, path: string): void {
    const message = `${path}: ${kind} has no JSON contract. Use a concrete type or explicitly set types.${kind} = 'allow'.`;
    if (this.policy[kind] !== 'allow') fail(node, message);
    if (!this.reported.has(kind))
      this.warnings.push(
        `${kind} is allowed: generated schemas may accept arbitrary JSON. First occurrence: ${path}.`,
      );
    this.reported.add(kind);
  }

  private collection(type: ts.Type, node: ts.Node, path: string, depth: number): boolean {
    if (isTupleTypeReference(type)) {
      const elements = tupleElementsOf(this.checker, type);
      if (elements.some((element, index) => element.rest && index !== elements.length - 1)) {
        fail(
          node,
          `${path}: non-trailing tuple rest elements are not supported by the schema engine. Define an explicit serialized DTO.`,
        );
      }
      elements.forEach((element, index) => {
        this.check(element.type, node, `${path}[${index}]`, element.optional, depth + 1);
      });
      return true;
    }
    if (!this.checker.isArrayType(type)) return false;
    const item = this.checker.getTypeArguments(type as ts.TypeReference)[0];
    const syntax = typeNodeOf(node);
    let itemNode: ts.TypeNode | undefined;
    if (syntax && ts.isArrayTypeNode(syntax)) itemNode = syntax.elementType;
    else if (syntax && ts.isTypeReferenceNode(syntax)) itemNode = syntax.typeArguments?.[0];
    if (item) this.check(item, itemNode ?? node, `${path}[]`, false, depth + 1);
    return true;
  }

  private projected(type: ts.Type): boolean {
    const parts = type.isIntersection() ? type.types : [type];
    return parts.some((part) =>
      part
        .getSymbol()
        ?.declarations?.some(
          (declaration) =>
            ts.isMappedTypeNode(declaration) && !identityMapping(declaration, this.checker),
        ),
    );
  }

  private intersectionIndexes(type: ts.Type): boolean {
    if (!type.isIntersection()) return false;
    const indexes = this.checker.getIndexInfosOfType(type);
    return (
      indexes.length > 1 && indexes.every((index) => templatePattern(index.keyType) !== undefined)
    );
  }

  private object(
    type: ts.Type,
    node: ts.Node,
    path: string,
    depth: number,
    primitiveMarker = false,
  ): void {
    if (this.collection(type, node, path, depth)) return;
    const builtIn = builtInName(type);
    if (builtIn === 'Date' || builtIn === 'URL') return;
    if (builtIn)
      fail(
        node,
        `${path}: built-in ${builtIn} is not a JSON model. Define its serialized DTO explicitly.`,
      );
    if (type.getCallSignatures().length || type.getConstructSignatures().length)
      fail(node, `${path}: functions/constructors are not JSON.`);
    for (const property of propertiesOf(this.checker, type, node)) {
      const member = property.node;
      const serializers = property.type.isUnionOrIntersection()
        ? property.type.types
        : [property.type];
      if (
        property.name === 'toJSON' &&
        serializers.some(
          (value) =>
            value.getCallSignatures().length ||
            value.getConstructSignatures().length ||
            isIntrinsicAnyType(value) ||
            isIntrinsicUnknownType(value),
        )
      )
        fail(member, `${path}: custom toJSON requires an explicit serialized schema or DTO.`);
      const projectedMethod =
        ts.isMethodDeclaration(member) &&
        ts.isClassDeclaration(member.parent) &&
        this.projected(type);
      if (
        !projectedMethod &&
        (ts.isMethodDeclaration(member) ||
          ts.isGetAccessorDeclaration(member) ||
          ts.isSetAccessorDeclaration(member)) &&
        ts.isClassDeclaration(member.parent)
      ) {
        continue;
      }
      if (ts.isPropertyDeclaration(member) && ts.isPrivateIdentifier(member.name)) continue;
      annotationsOf(member);
      const hidden = property.symbol.getJsDocTags().filter((tag) => tag.name === 'hidden');
      if (hidden.length) {
        for (const tag of hidden) {
          const value =
            tag.text
              ?.map((part) => part.text)
              .join('')
              .trim() ?? '';
          if (value !== '' && value !== 'true')
            fail(member, '@hidden is a presence flag; remove it to include the property.');
        }
        continue;
      }
      if (projectedMethod && this.overridden(member))
        fail(
          member,
          'Class method projections require a schema override on the DTO or its containing property.',
        );
      if (
        ts.canHaveModifiers(member) &&
        ts
          .getModifiers(member)
          ?.some(
            (modifier) =>
              modifier.kind === ts.SyntaxKind.PrivateKeyword ||
              modifier.kind === ts.SyntaxKind.ProtectedKeyword,
          )
      )
        fail(
          member,
          `${path}: TypeScript private/protected fields remain enumerable at runtime. Use #private state or a serialized DTO.`,
        );
      if (String(property.symbol.escapedName).startsWith('__@') && !primitiveMarker)
        fail(property.node, `${path}: symbol property keys are not JSON.`);
      if (primitiveMarker && property.type.flags & ts.TypeFlags.ESSymbolLike) continue;
      this.check(
        property.type,
        property.node,
        `${path}.${property.name}`,
        property.optional,
        depth + 1,
      );
    }
    const indexes = this.checker.getIndexInfosOfType(type);
    const templateIndexes =
      indexPattern(type, this.checker) !== undefined ||
      !!separateIndexes(type, this.checker) ||
      this.intersectionIndexes(type);
    for (const index of indexes) {
      if (index.keyType.flags & ts.TypeFlags.StringMapping)
        fail(
          index.declaration ?? node,
          `${path}: non-finite intrinsic string index keys require an explicit @jsonSchema for the dictionary wire format.`,
        );
      if (
        index.keyType.flags & ts.TypeFlags.Number &&
        (!(index.type.flags & ts.TypeFlags.Never) ||
          indexes.length > 1 ||
          type.isIntersection() ||
          !!type.getBaseTypes()?.length)
      )
        fail(
          index.declaration ?? node,
          `${path}: numeric index keys require an explicit @jsonSchema for the dictionary wire format; the schema engine otherwise accepts unrestricted string keys.`,
        );
      if (index.keyType.flags & ts.TypeFlags.TemplateLiteral && !templateIndexes)
        fail(
          index.declaration ?? node,
          `${path}: template index keys require an explicit @jsonSchema with patternProperties; the schema engine otherwise widens them to unrestricted keys.`,
        );
      if (index.keyType.flags & ts.TypeFlags.ESSymbolLike)
        fail(index.declaration ?? node, `${path}: symbol index keys are not JSON.`);
      this.check(index.type, node, `${path}[key]`, false, depth + 1);
    }
  }

  private overridden(node: ts.Node, active = new Set<ts.Node>()): boolean {
    if (active.has(node)) return false;
    if (active.size >= 100) fail(node, 'Schema override aliases exceed the safety budget.');
    const annotations = annotationsOf(node);
    const inline = annotations.get('inline');
    if (inline !== undefined) {
      if (!['', 'true', 'false'].includes(inline)) fail(node, '@inline must be true or false.');
      if (!ts.isPropertySignature(node) && !ts.isPropertyDeclaration(node) && !ts.isParameter(node))
        fail(node, '@inline belongs on a model property.');
    }
    const serialized = annotations.get('asType');
    const reference = annotations.get('ref');
    const explicit = annotations.get('jsonSchema');
    if (explicit !== undefined) {
      if (!explicit) fail(node, '@jsonSchema requires a JSON Schema object or boolean.');
      if (serialized !== undefined || reference !== undefined)
        fail(node, '@jsonSchema cannot be combined with @asType or @ref.');
      try {
        JSON.parse(explicit, (_key, value: unknown) => {
          if (typeof value === 'number' && !Number.isFinite(value))
            throw new Error('Schema numbers must be finite.');
          return value;
        });
      } catch (error) {
        fail(
          node,
          `Invalid @jsonSchema JSON: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      return true;
    }
    if (serialized !== undefined) {
      if (!serialized) fail(node, '@asType requires a JSON Schema type.');
      if (reference !== undefined) fail(node, '@ref and @asType cannot be combined.');
      return true;
    }
    if (reference !== undefined) {
      if (!reference) fail(node, '@ref requires a schema reference.');
      return true;
    }
    const syntax = typeNodeOf(node);
    const target = syntax && unwrapType(syntax);
    if (!target || !ts.isTypeReferenceNode(target)) return false;
    let symbol = this.checker.getSymbolAtLocation(target.typeName);
    if (symbol && symbol.flags & ts.SymbolFlags.Alias)
      symbol = this.checker.getAliasedSymbol(symbol);
    const next = new Set(active).add(node);
    return (
      symbol?.declarations?.some((declaration) => {
        if (this.overridden(declaration, next)) return true;
        if (!ts.isTypeAliasDeclaration(declaration)) return false;
        let input: ts.TypeNode = unwrapType(declaration.type);
        if (ts.isMappedTypeNode(input)) {
          if (input.questionToken || !identityMapping(input, this.checker)) return false;
          input = unwrapType((input.typeParameter.constraint as ts.TypeOperatorNode).type);
        }
        if (!ts.isTypeReferenceNode(input)) return false;
        const parameter = this.checker.getSymbolAtLocation(input.typeName);
        if (!parameter) return false;
        const position =
          declaration.typeParameters?.findIndex(
            (item) => this.checker.getSymbolAtLocation(item.name) === parameter,
          ) ?? -1;
        if (position < 0) return false;
        const argument =
          target.typeArguments?.[position] ?? declaration.typeParameters?.[position]?.default;
        return argument ? this.overridden(argument, next) : false;
      }) ?? false
    );
  }

  private refinable(type: ts.Type, node: ts.Node): boolean {
    if (
      !(type.flags & ts.TypeFlags.Object) ||
      this.checker.isArrayType(type) ||
      isTupleTypeReference(type) ||
      builtInName(type)
    )
      return false;
    for (const symbol of [type.getSymbol(), type.aliasSymbol]) {
      if (!symbol) continue;
      if (
        symbol.declarations?.some(
          (declaration) => ts.isClassDeclaration(declaration) || this.overridden(declaration),
        )
      )
        return false;
    }
    return propertiesOf(this.checker, type, node).every(
      (property) =>
        !property.symbol.getJsDocTags().some((tag) => tag.name === 'hidden') &&
        !this.overridden(property.node),
    );
  }

  check(type: ts.Type, node: ts.Node, path: string, optional = false, depth = 0): void {
    if (this.overridden(node)) return;
    type = unwrapNoInfer(type);
    if (this.mapped(type)) return;
    if (type.isNumberLiteral() && !Number.isFinite(type.value)) {
      if (
        type
          .getSymbol()
          ?.declarations?.some(
            (declaration) =>
              ts.isEnumMember(declaration) && annotationsOf(declaration).has('hidden'),
          )
      )
        return;
      fail(
        node,
        `${path}: ${String(type.value)} is not a finite JSON number. Use an explicit serialized schema.`,
      );
    }
    if (type.flags & ts.TypeFlags.StringMapping)
      fail(
        node,
        `${path}: non-finite intrinsic string mappings require an explicit serialized type (@asType) or @jsonSchema override.`,
      );
    if (type.flags & ts.TypeFlags.TemplateLiteral) {
      const pattern = annotationsOf(node).get('pattern');
      if (!pattern && templatePattern(type) === undefined)
        fail(
          node,
          `${path}: non-finite template literal types require an explicit @pattern; the schema engine otherwise widens them to string.`,
        );
    }
    if (depth > 100 || this.seen.size > 10000)
      fail(
        node,
        `${path}: type graph exceeds the safety budget (possibly expanding recursive generics).`,
      );
    if (isIntrinsicAnyType(type)) return this.unconstrained('any', node, path);
    if (isIntrinsicUnknownType(type)) return this.unconstrained('unknown', node, path);
    if (isTypeFlagSet(type, ts.TypeFlags.Undefined | ts.TypeFlags.Void)) {
      if (!optional)
        fail(
          node,
          `${path}: undefined/void is not JSON. Make an object property optional; use EmptyResponse for no HTTP body.`,
        );
      return;
    }
    if (
      type.flags &
      (ts.TypeFlags.BigIntLike | ts.TypeFlags.ESSymbolLike | ts.TypeFlags.TypeParameter)
    )
      fail(node, `${path}: ${this.checker.typeToString(type)} cannot be represented as JSON.`);
    if (this.seen.has(type)) return;
    if (type.isUnionOrIntersection()) {
      if (type.isIntersection() && type.types.every((part) => this.refinable(part, node))) {
        this.seen.add(type);
        this.object(type, node, path, depth);
        return;
      }
      const syntax = typeNodeOf(node);
      let members: readonly ts.TypeNode[] = [];
      if (syntax && (ts.isUnionTypeNode(syntax) || ts.isIntersectionTypeNode(syntax)))
        members = syntax.types;
      const primitiveBrand =
        type.isIntersection() &&
        type.types.some(
          (part) =>
            part.flags &
            (ts.TypeFlags.StringLike | ts.TypeFlags.NumberLike | ts.TypeFlags.BooleanLike),
        );
      for (const part of type.types) {
        const member = members.find(
          (candidate) => this.checker.getTypeAtLocation(candidate) === part,
        );
        if (member && this.overridden(member)) continue;
        // A field-level pattern still constrains the string branch of a nullable union.
        const location = part.flags & ts.TypeFlags.TemplateLiteral ? node : (member ?? node);
        if (primitiveBrand && part.flags & ts.TypeFlags.Object)
          this.object(part, location, path, depth + 1, true);
        else this.check(part, location, path, optional, depth + 1);
      }
      return;
    }
    if (!(type.flags & ts.TypeFlags.Object)) return;
    this.seen.add(type);
    const source = mutabilitySource(type, this.checker);
    if (
      source &&
      source !== type &&
      (separateIndexes(source, this.checker) || this.intersectionIndexes(source))
    ) {
      this.check(source, node, path, optional, depth + 1);
      return;
    }
    this.object(type, node, path, depth);
  }
}
