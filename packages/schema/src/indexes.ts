import ts from 'typescript';
import { disjointTemplates, escapePattern, templatePattern } from '@opentyped/ast/pattern';
import type { Schema } from '~/definition';
import { SchemaError } from '~/error';
import type { SchemaProvenance } from '~/provenance';
import { SchemaProjection } from '~/projection';
import { IndexOrigins } from '~/origin';
import type { Origin } from '~/origin';
import type { TypeBindings } from '~/projection';
import type { SchemaIntersection } from '~/intersection';

export interface SchemaEdge {
  bindings: TypeBindings;
  encode: (type: ts.Type, node: ts.Node, bindings?: TypeBindings) => Schema;
}
interface Entry {
  keyType: ts.Type;
  pattern: string | undefined;
  value: Schema;
  keys: Schema[];
}

/** Index domains own their value intersections and conditional property-name assertions. */
export class SchemaIndexes {
  private readonly projection: SchemaProjection;
  private readonly origins: IndexOrigins;

  constructor(
    private readonly checker: ts.TypeChecker,
    private readonly provenance: SchemaProvenance,
    private readonly override: (node: ts.Node, bindings: TypeBindings) => Schema | undefined,
    root: string,
  ) {
    this.projection = new SchemaProjection(checker, root);
    this.origins = new IndexOrigins(checker, root);
  }

  apply(
    type: ts.Type,
    node: ts.Node,
    properties: Record<string, Schema>,
    required: string[],
    encode: (type: ts.Type, node: ts.Node) => Schema,
    bindings: TypeBindings,
    edge: (type: ts.Type, node: ts.Node) => SchemaEdge,
    intersection: SchemaIntersection,
  ): Schema {
    const indexes = this.checker.getIndexInfosOfType(type);
    if (indexes.some((index) => index.keyType.flags & ts.TypeFlags.ESSymbolLike))
      throw new SchemaError('Symbol index signatures have no JSON object representation', node);
    const forbiddenNumeric = indexes.every((index) => {
      const source = index.declaration?.type ?? this.syntax(node);
      return (
        index.keyType.flags & ts.TypeFlags.Number &&
        index.type.flags & ts.TypeFlags.Never &&
        (!index.declaration || !ts.getJSDocTags(index.declaration).length) &&
        (!source || !this.projection.containsOrigins(source, bindings))
      );
    });
    if (indexes.some((index) => index.keyType.flags & ts.TypeFlags.Number) && !forbiddenNumeric)
      throw new SchemaError(
        'Numeric index signatures require an explicit key serialization schema',
        node,
      );
    const patterns = indexes.filter(
      (index) => !(index.keyType.flags & ts.TypeFlags.String) && !forbiddenNumeric,
    );
    if (!patterns.length)
      return this.strings(type, node, properties, required, encode, bindings, edge, intersection);
    for (const index of patterns)
      if (!templatePattern(index.keyType))
        throw new SchemaError(
          'Template index keys require unrestricted string interpolation',
          node,
        );
    const scope = this.merge(this.projection.bindings(type), bindings);
    const origins = this.origins.of(
      this.syntax(node) ?? (type.aliasSymbol ?? type.getSymbol())?.declarations?.[0],
      scope,
    );
    const entries = indexes.map((index) =>
      this.entry(index, type, node, origins, scope, edge, intersection),
    );
    const string = entries.find((entry) => entry.pattern === undefined);
    const patterned = entries.filter(
      (entry): entry is Entry & { pattern: string } => entry.pattern !== undefined,
    );
    const record = this.record(type, node, scope);
    if (record) {
      const keyType = this.projection.resolved(
        this.checker.getTypeFromTypeNode(record.key),
        record.bindings,
      );
      const context = edge(keyType, record.key);
      const keyScope = this.merge(record.bindings, context.bindings);
      let keys = context.encode(keyType, record.key, keyScope);
      if (this.override(record.key, keyScope) === undefined)
        keys = this.provenance.apply(
          keys,
          record.key,
          context.encode,
          keyType,
          type,
          keyScope,
          intersection,
        );
      const value = entries.reduce<Schema>(
        (value, entry) => intersection.apply(value, entry.value, node),
        true,
      );
      for (const name of Object.keys(properties))
        properties[name] = intersection.apply(properties[name]!, value, node);
      return {
        type: 'object',
        properties,
        ...(required.length ? { required } : {}),
        additionalProperties: value,
        propertyNames: keys,
      };
    }
    for (const [name, value] of Object.entries(properties)) {
      properties[name] = entries
        .filter((entry) => !entry.pattern || new RegExp(entry.pattern).test(name))
        .reduce((value, entry) => intersection.apply(value, entry.value, node), value);
    }
    const propertyNames: Schema[] = [...(string?.keys ?? [])];
    for (const entry of patterned)
      for (const keys of entry.keys)
        propertyNames.push({ anyOf: [{ not: { pattern: entry.pattern } }, keys] });
    const regions = this.regions(patterned, node, intersection);
    const patternProperties = Object.create(null) as Record<string, Schema>;
    for (const [pattern, value] of regions) {
      const matcher = new RegExp(pattern);
      const names = Object.keys(properties).filter((name) => matcher.test(name));
      const excluded = names.length
        ? `^(?!(?:${names.map(escapePattern).join('|')})(?![\\s\\S]))${pattern.slice(1)}`
        : pattern;
      patternProperties[excluded] = string ? intersection.apply(value, string.value, node) : value;
    }
    return {
      type: 'object',
      properties,
      ...(required.length ? { required } : {}),
      additionalProperties: string?.value ?? false,
      patternProperties,
      ...(propertyNames.length
        ? {
            propertyNames: propertyNames.length === 1 ? propertyNames[0] : { allOf: propertyNames },
          }
        : {}),
    };
  }

  private entry(
    index: ts.IndexInfo,
    owner: ts.Type,
    node: ts.Node,
    sources: Origin[],
    bindings: TypeBindings,
    edge: (type: ts.Type, node: ts.Node) => SchemaEdge,
    intersection: SchemaIntersection,
  ): Entry {
    const pattern = templatePattern(index.keyType);
    const origins = sources.filter((origin) => {
      const key = this.projection.resolved(
        this.checker.getTypeFromTypeNode(origin.key),
        origin.bindings,
      );
      return (key.isUnion() ? key.types : [key]).some(
        (part) =>
          part === index.keyType ||
          (pattern !== undefined && templatePattern(part) === pattern) ||
          (!pattern && !!(part.flags & ts.TypeFlags.String)),
      );
    });
    if (!origins.length && index.declaration?.parameters[0]?.type)
      origins.push({
        key: index.declaration.parameters[0].type,
        value: index.declaration.type!,
        bindings,
      });
    const values = origins.length
      ? origins
      : [{ key: undefined, value: this.provenance.recordValue(owner) ?? node, bindings }];
    const value = values.reduce<Schema>((result, origin) => {
      const source = this.projection.replacesValue(owner) ? node : origin.value;
      const context = edge(index.type, source),
        scope = this.merge(origin.bindings, context.bindings);
      const candidate =
        origins.length > 1 && !this.projection.replacesValue(owner)
          ? this.projection.resolved(this.checker.getTypeAtLocation(origin.value), scope)
          : index.type;
      const type =
        candidate.flags &
        (ts.TypeFlags.TypeParameter |
          ts.TypeFlags.Conditional |
          ts.TypeFlags.IndexedAccess |
          ts.TypeFlags.Substitution |
          ts.TypeFlags.StringMapping)
          ? index.type
          : candidate;
      let value = context.encode(type, source, scope);
      if (this.override(source, scope) === undefined)
        value = this.provenance.apply(
          value,
          source,
          context.encode,
          type,
          owner,
          scope,
          intersection,
        );
      return intersection.apply(result, value, node);
    }, true);
    const keys = origins
      .filter((origin) => this.projection.containsOrigins(origin.key, origin.bindings))
      .map((origin) => {
        const context = edge(index.keyType, origin.key),
          scope = this.merge(origin.bindings, context.bindings);
        return this.provenance.apply(
          { type: 'string', ...(pattern ? { pattern } : {}) },
          origin.key,
          context.encode,
          index.keyType,
          owner,
          scope,
          intersection,
        );
      });
    return { keyType: index.keyType, pattern, value, keys };
  }

  private regions(
    entries: (Entry & { pattern: string })[],
    node: ts.Node,
    intersection: SchemaIntersection,
  ): Map<string, Schema> {
    const patterns = new Map<string, Schema>();
    for (const entry of entries)
      patterns.set(
        entry.pattern,
        intersection.apply(patterns.get(entry.pattern) ?? true, entry.value, node),
      );
    const pairs = [...patterns];
    if (pairs.length <= 1) return patterns;
    const types = new Map(entries.map((entry) => [entry.pattern, entry.keyType]));
    const disjoint = (left: string, right: string): boolean =>
      disjointTemplates(types.get(left)!, types.get(right)!);
    if (
      pairs.every(([pattern], index) =>
        pairs.slice(index + 1).every(([other]) => disjoint(pattern, other)),
      )
    )
      return patterns;
    if (pairs.length > 6)
      throw new SchemaError('Overlapping template indexes exceed the 63-region budget', node);
    const result = new Map<string, Schema>();
    for (let mask = 1; mask < 2 ** pairs.length; mask++) {
      const selected = pairs.filter((_, index) => mask & (1 << index));
      if (
        selected.some(([pattern], index) =>
          selected.slice(index + 1).some(([other]) => disjoint(pattern, other)),
        )
      )
        continue;
      const conditions = pairs
        .map(([pattern], index) => `${mask & (1 << index) ? '(?=' : '(?!'}${pattern})`)
        .join('');
      const value = selected.reduce<Schema>(
        (value, [, part]) => intersection.apply(value, part, node),
        true,
      );
      result.set(`^${conditions}[\\s\\S]*(?![\\s\\S])`, value);
    }
    return result;
  }

  private record(type: ts.Type, node: ts.Node, bindings: TypeBindings): Origin | undefined {
    if (
      type.isIntersection() ||
      type
        .getSymbol()
        ?.declarations?.some(
          (node) => ts.isInterfaceDeclaration(node) || ts.isClassDeclaration(node),
        )
    )
      return undefined;
    return this.recordSyntax(
      this.syntax(node) ?? type.aliasSymbol?.declarations?.find(ts.isTypeAliasDeclaration)?.type,
      bindings,
      new Set(),
    );
  }

  private recordSyntax(
    node: ts.Node | undefined,
    bindings: TypeBindings,
    seen: Set<ts.Node>,
  ): Origin | undefined {
    if (!node || seen.has(node)) return undefined;
    seen.add(node);
    if (ts.isParenthesizedTypeNode(node)) return this.recordSyntax(node.type, bindings, seen);
    if (!(ts.isTypeReferenceNode(node) || ts.isImportTypeNode(node))) return undefined;
    let symbol = this.checker.getSymbolAtLocation(
      ts.isTypeReferenceNode(node) ? node.typeName : (node.qualifier ?? node),
    );
    if (symbol?.flags && symbol.flags & ts.SymbolFlags.Alias)
      symbol = this.checker.getAliasedSymbol(symbol);
    const declaration = symbol?.declarations?.find(ts.isTypeAliasDeclaration);
    if (!declaration) return undefined;
    if (declaration.getSourceFile().hasNoDefaultLib) {
      if (symbol?.name === 'Record' && node.typeArguments?.[0] && node.typeArguments[1])
        return { key: node.typeArguments[0], value: node.typeArguments[1], bindings };
      return ['Readonly', 'Partial', 'Required', 'Pick', 'Omit'].includes(symbol?.name ?? '')
        ? this.recordSyntax(node.typeArguments?.[0], bindings, seen)
        : undefined;
    }
    return this.recordSyntax(
      declaration.type,
      this.projection.bind(node, declaration, bindings),
      seen,
    );
  }

  private merge(first: TypeBindings, second: TypeBindings): TypeBindings {
    return Object.assign(new Map([...first, ...second]), {
      origins: new Map([...(first.origins ?? []), ...(second.origins ?? [])]),
    });
  }
  private syntax(node: ts.Node): ts.TypeNode | undefined {
    return ts.isTypeNode(node)
      ? node
      : 'type' in node
        ? (node.type as ts.TypeNode | undefined)
        : undefined;
  }

  private strings(
    type: ts.Type,
    node: ts.Node,
    properties: Record<string, Schema>,
    required: string[],
    encode: (type: ts.Type, node: ts.Node) => Schema,
    bindings: TypeBindings,
    edgeContext: (type: ts.Type, node: ts.Node) => SchemaEdge,
    intersection: SchemaIntersection,
  ): Schema {
    const stringIndex = this.checker
      .getIndexInfosOfType(type)
      .find((index) => index.keyType.flags & ts.TypeFlags.String);
    let indexDeclaration = stringIndex?.declaration;
    let indexOwner = type;
    const indexOwners = new Set<ts.Type>();
    while (
      !indexDeclaration &&
      !indexOwners.has(indexOwner) &&
      indexOwner.aliasSymbol?.name === 'Readonly' &&
      indexOwner.aliasSymbol.declarations?.every(
        (declaration) => declaration.getSourceFile().hasNoDefaultLib,
      )
    ) {
      indexOwners.add(indexOwner);
      const source = indexOwner.aliasTypeArguments?.[0];
      if (!source) break;
      indexOwner = source;
      indexDeclaration = this.checker
        .getIndexInfosOfType(source)
        .find((index) => index.keyType.flags & ts.TypeFlags.String)?.declaration;
    }
    const indexValue = indexDeclaration?.type ?? this.provenance.recordValue(type) ?? node;
    const indexContext = stringIndex ? edgeContext(stringIndex.type, indexValue) : undefined;
    const indexBindings = indexContext?.bindings ?? bindings;
    const scope = this.merge(this.projection.bindings(type), bindings);
    const origins = this.origins.of(
      this.syntax(node) ?? (type.aliasSymbol ?? type.getSymbol())?.declarations?.[0],
      scope,
    );
    const entry =
      stringIndex && origins.length
        ? this.entry(stringIndex, type, node, origins, scope, edgeContext, intersection)
        : undefined;
    let additionalProperties = entry
      ? entry.value
      : stringIndex
        ? encode(stringIndex.type, indexValue)
        : false;
    if (!entry && stringIndex && this.override(indexValue, indexBindings) === undefined)
      additionalProperties = this.provenance.apply(
        additionalProperties,
        indexValue,
        indexContext!.encode,
        stringIndex.type,
        type,
        indexBindings,
        intersection,
      );
    const keyNode = indexDeclaration?.parameters[0]?.type;
    const keys = entry?.keys.length
      ? entry.keys.length === 1
        ? entry.keys[0]
        : { allOf: entry.keys }
      : stringIndex && keyNode
        ? this.provenance.apply(
            { type: 'string' },
            keyNode,
            edgeContext(stringIndex.keyType, keyNode).encode,
            stringIndex.keyType,
            type,
            edgeContext(stringIndex.keyType, keyNode).bindings,
            intersection,
          )
        : undefined;
    if (stringIndex)
      for (const name of Object.keys(properties))
        properties[name] = intersection.apply(properties[name]!, additionalProperties, node);
    return {
      type: 'object',
      ...(Object.keys(properties).length ? { properties } : {}),
      ...(required.length ? { required } : {}),
      additionalProperties,
      ...(keys !== undefined && JSON.stringify(keys) !== '{"type":"string"}'
        ? { propertyNames: keys }
        : {}),
    };
  }
}
