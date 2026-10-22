import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { symbolProperty } from '@opentyped/oapi-ast/navigation';
import type { Schema } from '~/definition';
import { SchemaError } from '~/error';
import { queryOrigin } from '~/query';
import { documentationOf } from '@opentyped/oapi-ast/jsdoc';

export interface AnnotationOrigin {
  readonly syntax: ts.TypeNode;
  readonly bindings: TypeBindings;
  readonly key: string;
}

export interface TypeBindings extends ReadonlyMap<ts.Type, ts.Type> {
  readonly origins?: ReadonlyMap<ts.Type, AnnotationOrigin> | undefined;
}

/** Serialization policies use checker-resolved domains, never evaluate TypeScript expressions. */
export class SchemaProjection {
  constructor(
    private readonly checker: ts.TypeChecker,
    private readonly root: string,
  ) {}

  containsKeys(syntax: ts.TypeNode, seen = new Set<ts.Node>()): boolean {
    if (seen.has(syntax)) return false;
    seen.add(syntax);
    if (ts.isTypeOperatorNode(syntax) && syntax.operator === ts.SyntaxKind.KeyOfKeyword)
      return true;
    if (ts.isTypeReferenceNode(syntax) || ts.isImportTypeNode(syntax)) {
      let symbol = this.checker.getSymbolAtLocation(
        ts.isTypeReferenceNode(syntax) ? syntax.typeName : (syntax.qualifier ?? syntax),
      );
      if (symbol?.flags && symbol.flags & ts.SymbolFlags.Alias)
        symbol = this.checker.getAliasedSymbol(symbol);
      const declaration = symbol?.declarations?.find(ts.isTypeAliasDeclaration);
      if (declaration && !declaration.getSourceFile().hasNoDefaultLib) {
        if (
          ts
            .getJSDocTags(declaration)
            .some((tag) => tag.tagName.text === 'jsonSchema' || tag.tagName.text === 'asType')
        )
          return false;
        if (this.containsKeys(declaration.type, seen)) return true;
      }
    }
    return Boolean(
      ts.forEachChild(syntax, (node) => ts.isTypeNode(node) && this.containsKeys(node, seen)),
    );
  }

  /** Find erased alias metadata without attempting to evaluate type expressions. */
  containsAnnotations(
    syntax: ts.TypeNode,
    bindings: TypeBindings = new Map(),
    seen = new Set<ts.Node>(),
    serialized = false,
  ): boolean {
    if (seen.has(syntax)) return false;
    seen.add(syntax);
    if (ts.isTypeQueryNode(syntax) || (ts.isImportTypeNode(syntax) && syntax.isTypeOf)) {
      const origin = queryOrigin(syntax, this.checker);
      if (origin) {
        const tags = ts.getJSDocTags(origin);
        if (tags.some((tag) => tag.tagName.text === 'jsonSchema' || tag.tagName.text === 'asType'))
          return serialized;
        if (tags.some((tag) => tag.tagName.text !== 'schema') || documentationOf(origin))
          return true;
        const source = ts.isTypeNode(origin) ? origin : origin.type;
        if (source && this.containsAnnotations(source, bindings, seen, serialized)) return true;
      }
      let symbol = this.checker.getSymbolAtLocation(
        ts.isTypeQueryNode(syntax) ? syntax.exprName : (syntax.qualifier ?? syntax),
      );
      if (symbol?.flags && symbol.flags & ts.SymbolFlags.Alias)
        symbol = this.checker.getAliasedSymbol(symbol);
      const scan = (node: ts.Node): boolean => {
        if (seen.has(node)) return false;
        if (ts.isTypeNode(node)) return this.containsAnnotations(node, bindings, seen, serialized);
        seen.add(node);
        return Boolean(ts.forEachChild(node, scan));
      };
      if (symbol?.declarations?.some(scan)) return true;
    }
    if (ts.isTypeReferenceNode(syntax) || ts.isImportTypeNode(syntax)) {
      const origin = bindings.origins?.get(this.checker.getTypeFromTypeNode(syntax));
      if (origin && this.containsAnnotations(origin.syntax, origin.bindings, seen, serialized))
        return true;
      let symbol = this.checker.getSymbolAtLocation(
        ts.isTypeReferenceNode(syntax) ? syntax.typeName : (syntax.qualifier ?? syntax),
      );
      if (symbol?.flags && symbol.flags & ts.SymbolFlags.Alias)
        symbol = this.checker.getAliasedSymbol(symbol);
      const declaration = symbol?.declarations?.find(ts.isTypeAliasDeclaration);
      if (
        declaration &&
        !declaration.getSourceFile().hasNoDefaultLib &&
        !seen.has(declaration.type)
      ) {
        const tags = ts.getJSDocTags(declaration);
        if (tags.some((tag) => tag.tagName.text === 'jsonSchema' || tag.tagName.text === 'asType'))
          return serialized;
        if (tags.some((tag) => tag.tagName.text !== 'schema') || documentationOf(declaration))
          return true;
        if (this.containsAnnotations(declaration.type, bindings, seen, serialized)) return true;
      }
    }
    if (ts.isTypeLiteralNode(syntax)) return false;
    const scan = (node: ts.Node): boolean =>
      ts.isTypeNode(node)
        ? this.containsAnnotations(node, bindings, seen, serialized)
        : Boolean(ts.forEachChild(node, scan));
    return Boolean(ts.forEachChild(syntax, scan));
  }

  containsOrigins(syntax: ts.TypeNode, bindings: TypeBindings = new Map()): boolean {
    return this.containsAnnotations(syntax, bindings, new Set(), true);
  }

  scalar(type: ts.Type): boolean {
    return type.isUnion()
      ? type.types.every((part) => this.scalar(part))
      : Boolean(
          type.flags &
          (ts.TypeFlags.StringLike |
            ts.TypeFlags.NumberLike |
            ts.TypeFlags.BooleanLike |
            ts.TypeFlags.Null |
            ts.TypeFlags.Never),
        ) && !(type.flags & ts.TypeFlags.TemplateLiteral);
  }

  /** Only conventional phantom fields may disappear from a primitive's JSON representation. */
  brand(type: ts.Type, node: ts.Node): readonly ts.Type[] | undefined {
    if (!type.isIntersection()) return undefined;
    const primitives = type.types.filter((part) => this.scalar(part));
    if (!primitives.length) return undefined;
    const markers = type.types.filter((part) => !primitives.includes(part));
    const seen = new Set<ts.Type>();
    for (const marker of markers) {
      if (seen.has(marker)) continue;
      seen.add(marker);
      if (seen.size > 128) throw new SchemaError('Primitive brand markers exceed 128 types', node);
      const declaration = (marker.aliasSymbol ?? marker.getSymbol())?.declarations?.[0];
      if (
        declaration &&
        ts
          .getJSDocTags(declaration)
          .some((tag) => !['schema', 'schemaName'].includes(tag.tagName.text))
      )
        throw new SchemaError(
          'Annotated brand markers require an explicit schema on the complete branded type',
          declaration,
        );
      if (
        !(marker.flags & ts.TypeFlags.Object) ||
        marker.getCallSignatures().length ||
        marker.getConstructSignatures().length ||
        this.checker.getIndexInfosOfType(marker).length
      )
        throw new SchemaError('Primitive brand markers require phantom object fields', node);
      for (const property of this.checker.getPropertiesOfType(marker)) {
        if (property.name !== '__brand' && !symbolProperty(property))
          throw new SchemaError(
            'Primitive intersections with runtime fields require an explicit serialization schema',
            node,
          );
      }
      markers.push(...(marker.getBaseTypes() ?? []));
    }
    return primitives;
  }

  bindings(type?: ts.Type): TypeBindings {
    const bindings = new Map<ts.Type, ts.Type>();
    if (!type) return bindings;
    if (
      type.flags & ts.TypeFlags.Object &&
      (type as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference
    ) {
      const reference = type as ts.TypeReference;
      const arguments_ = this.checker.getTypeArguments(reference);
      reference.target.typeParameters?.forEach((parameter, index) => {
        if (arguments_[index]) bindings.set(parameter, arguments_[index]);
      });
    }
    const declaration = type.aliasSymbol?.declarations?.find(ts.isTypeAliasDeclaration);
    declaration?.typeParameters?.forEach((parameter, index) => {
      const argument = type.aliasTypeArguments?.[index];
      if (argument) bindings.set(this.checker.getTypeAtLocation(parameter), argument);
    });
    if (declaration) {
      let syntax = declaration.type;
      const seen = new Set<ts.Node>();
      while ((ts.isTypeReferenceNode(syntax) || ts.isImportTypeNode(syntax)) && !seen.has(syntax)) {
        seen.add(syntax);
        let symbol = this.checker.getSymbolAtLocation(
          ts.isTypeReferenceNode(syntax) ? syntax.typeName : (syntax.qualifier ?? syntax),
        );
        if (symbol?.flags && symbol.flags & ts.SymbolFlags.Alias)
          symbol = this.checker.getAliasedSymbol(symbol);
        const target = symbol?.declarations?.find(
          (node) => ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node),
        );
        if (!target) break;
        for (const [parameter, argument] of this.bind(syntax, target, bindings))
          bindings.set(parameter, argument);
        if (!ts.isTypeAliasDeclaration(target)) break;
        syntax = target.type;
      }
    }
    return bindings;
  }

  bind(
    syntax: ts.TypeReferenceNode | ts.ImportTypeNode | ts.ExpressionWithTypeArguments,
    declaration: ts.Declaration,
    bindings: TypeBindings,
  ): TypeBindings {
    if (
      !ts.isTypeAliasDeclaration(declaration) &&
      !ts.isInterfaceDeclaration(declaration) &&
      !ts.isClassDeclaration(declaration)
    )
      return bindings;
    const result = new Map(bindings);
    const origins = new Map(bindings.origins);
    declaration.typeParameters?.forEach((parameter, index) => {
      const argument = syntax.typeArguments?.[index] ?? parameter.default;
      if (argument) {
        const parameterType = this.checker.getTypeAtLocation(parameter);
        const argumentType = this.checker.getTypeFromTypeNode(argument);
        const forwarded = bindings.origins?.get(argumentType);
        if (forwarded) origins.set(parameterType, forwarded);
        else if (this.containsOrigins(argument, bindings)) {
          origins.set(parameterType, {
            syntax: argument,
            bindings,
            key: this.originKey(argument, bindings),
          });
        } else origins.delete(parameterType);
        result.set(
          this.checker.getTypeAtLocation(parameter),
          this.bound(this.checker.getTypeFromTypeNode(argument), bindings),
        );
      }
    });
    return Object.assign(result, { origins });
  }

  resolved(type: ts.Type, bindings: TypeBindings): ts.Type {
    return this.bound(type, bindings);
  }

  declarationKey(declaration: ts.Declaration): string {
    const names: string[] = [];
    let current: ts.Node | undefined = declaration;
    while (current && !ts.isSourceFile(current)) {
      if ('name' in current && current.name && ts.isIdentifier(current.name as ts.Node))
        names.unshift((current.name as ts.Identifier).text);
      current = current.parent;
    }
    return JSON.stringify([
      path
        .relative(fs.realpathSync(this.root), fs.realpathSync(declaration.getSourceFile().fileName))
        .replaceAll(path.sep, '/'),
      names,
    ]);
  }

  originKey(syntax: ts.TypeNode, bindings: TypeBindings): string {
    if (ts.isTypeQueryNode(syntax)) {
      let symbol = this.checker.getSymbolAtLocation(syntax.exprName);
      if (symbol?.flags && symbol.flags & ts.SymbolFlags.Alias)
        symbol = this.checker.getAliasedSymbol(symbol);
      const declaration = symbol?.declarations?.[0];
      return JSON.stringify([
        'query',
        declaration ? this.declarationKey(declaration) : syntax.exprName.getText(),
      ]);
    }
    if (ts.isTypeReferenceNode(syntax) || ts.isImportTypeNode(syntax)) {
      const origin = bindings.origins?.get(this.checker.getTypeFromTypeNode(syntax));
      if (origin) return origin.key;
      let symbol = this.checker.getSymbolAtLocation(
        ts.isTypeReferenceNode(syntax) ? syntax.typeName : (syntax.qualifier ?? syntax),
      );
      if (symbol?.flags && symbol.flags & ts.SymbolFlags.Alias)
        symbol = this.checker.getAliasedSymbol(symbol);
      const declaration = symbol?.declarations?.[0];
      return JSON.stringify([
        'reference',
        declaration
          ? this.declarationKey(declaration)
          : (ts.isTypeReferenceNode(syntax)
              ? syntax.typeName
              : (syntax.qualifier ?? syntax)
            ).getText(),
        syntax.typeArguments?.map((argument) => this.originKey(argument, bindings)) ?? [],
      ]);
    }
    const children: string[] = [];
    ts.forEachChild(syntax, (child) => {
      if (ts.isTypeNode(child)) children.push(this.originKey(child, bindings));
    });
    return JSON.stringify([syntax.kind, children.length ? children : syntax.getText()]);
  }

  private bound(type: ts.Type, bindings: TypeBindings): ts.Type {
    const seen = new Set<ts.Type>();
    while (bindings.has(type) && !seen.has(type)) {
      seen.add(type);
      type = bindings.get(type)!;
    }
    return type;
  }

  replacesValue(
    type: ts.Type | undefined,
    inherited: TypeBindings = new Map(),
    seen = new Set<ts.Type>(),
  ): boolean {
    if (!type || seen.has(type)) return false;
    seen.add(type);
    const mapped = type.getSymbol()?.declarations?.find(ts.isMappedTypeNode);
    let value = mapped?.type;
    if (!mapped || !value) return false;
    while (ts.isParenthesizedTypeNode(value)) value = value.type;
    if (
      ts.isLiteralTypeNode(value) ||
      (value.kind >= ts.SyntaxKind.FirstKeyword && value.kind <= ts.SyntaxKind.LastKeyword)
    )
      return true;
    if (!ts.isIndexedAccessTypeNode(value) || !ts.isTypeReferenceNode(value.indexType))
      return false;
    const parameter = this.checker.getSymbolAtLocation(mapped.typeParameter.name);
    if (this.checker.getSymbolAtLocation(value.indexType.typeName) !== parameter) return false;
    const bindings = new Map([...inherited, ...this.bindings(type)]);
    const source = this.bound(this.checker.getTypeFromTypeNode(value.objectType), bindings);
    return this.replacesValue(source, bindings, seen);
  }

  keys(
    syntax: ts.TypeOperatorNode,
    resolved: ts.Type | undefined,
    bindings: TypeBindings,
  ): Schema | undefined {
    if (syntax.operator !== ts.SyntaxKind.KeyOfKeyword || !resolved) return undefined;
    const source = this.bound(this.checker.getTypeFromTypeNode(syntax.type), bindings);
    if (
      source.flags &
      (ts.TypeFlags.TypeParameter | ts.TypeFlags.Conditional | ts.TypeFlags.IndexedAccess)
    ) {
      throw new SchemaError(
        'Keyof annotation source is unresolved; provide a named concrete key model',
        syntax,
      );
    }
    const values = (resolved.isUnion() ? resolved.types : [resolved]).filter(
      (type) => !(type.flags & ts.TypeFlags.Undefined),
    );
    if (!values.every((value) => value.isStringLiteral() || value.isNumberLiteral()))
      return undefined;
    const visible = values.filter((value) => {
      const property = this.checker.getPropertyOfType(
        source,
        String((value as ts.LiteralType).value),
      );
      return (
        !property ||
        !this.checker
          .getRootSymbols(property)
          .some((symbol) => symbol.getJsDocTags(this.checker).some((tag) => tag.name === 'hidden'))
      );
    });
    if (!visible.length) return false;
    const types = [
      ...new Set(visible.map((value) => (value.isNumberLiteral() ? 'number' : 'string'))),
    ];
    return {
      type: types.length === 1 ? types[0] : types,
      enum: visible.map((value) => (value as ts.LiteralType).value),
    };
  }

  intersection(
    syntax: ts.IntersectionTypeNode,
    resolved: ts.Type | undefined,
    encode: (type: ts.Type, node: ts.Node) => Schema,
  ): Schema | undefined {
    if (!resolved || !(resolved.flags & ts.TypeFlags.Never)) return undefined;
    const operands = syntax.types.map((part) => this.checker.getTypeFromTypeNode(part));
    if (!operands.some((type) => type.flags & ts.TypeFlags.EnumLike)) return undefined;
    const scalar = (type: ts.Type): boolean =>
      type.isUnion()
        ? type.types.every(scalar)
        : Boolean(
            type.flags &
            (ts.TypeFlags.StringLike |
              ts.TypeFlags.NumberLike |
              ts.TypeFlags.BooleanLike |
              ts.TypeFlags.Null),
          ) && !(type.flags & ts.TypeFlags.TemplateLiteral);
    if (!operands.every(scalar)) return undefined;
    return { allOf: operands.map((type, index) => encode(type, syntax.types[index]!)) };
  }
}
