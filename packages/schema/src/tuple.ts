import ts from 'typescript';
import { SCHEMA_ANNOTATIONS } from '@opentyped/openapi/schema/graph';
import { annotate } from '~/annotation';
import type { Schema } from '~/definition';
import { SchemaError } from '~/error';
import { SchemaProjection } from '~/projection';
import type { TypeBindings } from '~/projection';

/** Tuple labels describe positions without changing their value schema. */
export function tupleItem(
  schema: Schema,
  declaration: ts.NamedTupleMember | ts.ParameterDeclaration | undefined,
): Schema {
  return declaration
    ? {
        ...(typeof schema === 'object' ? schema : schema ? {} : { not: {} }),
        title: declaration.name.getText(),
      }
    : schema;
}

interface Segment {
  prefix: Schema[];
  items: Schema;
  min: number;
  max: number;
  constrained: boolean;
  position?: Segment;
}
interface Row {
  parts: Segment[];
  positions: Segment[];
  min: number;
  max: number;
}
type Render = (type: ts.Type, syntax: ts.TypeNode, bindings: TypeBindings) => Schema;

/** Compose checker-resolved collection segments without discarding alias length bounds. */
export class SchemaTuple {
  private readonly projection: SchemaProjection;

  constructor(
    private readonly checker: ts.TypeChecker,
    root: string,
  ) {
    this.projection = new SchemaProjection(checker, root);
  }

  project(syntax: ts.TupleTypeNode, bindings: TypeBindings, render: Render): Schema {
    const rows = this.rows(syntax, bindings, render, new Set());
    const schemas = rows.map((row) => {
      const schema = this.flatten(row.parts, row.min, row.max, syntax);
      const positional = this.flatten(row.positions, row.min, row.max, syntax);
      return JSON.stringify(schema) === JSON.stringify(positional)
        ? schema
        : { allOf: [schema, positional] };
    });
    return !schemas.length ? false : schemas.length === 1 ? schemas[0]! : { anyOf: schemas };
  }

  private rows(
    syntax: ts.TupleTypeNode,
    bindings: TypeBindings,
    render: Render,
    active: Set<ts.Node>,
  ): Row[] {
    let rows: Row[] = [{ parts: [], positions: [], min: 0, max: 0 }];
    syntax.elements.forEach((member, index) => {
      const spread =
        ts.isRestTypeNode(member) || (ts.isNamedTupleMember(member) && member.dotDotDotToken);
      const type =
        ts.isNamedTupleMember(member) || ts.isOptionalTypeNode(member) || ts.isRestTypeNode(member)
          ? member.type
          : member;
      const parts = spread
        ? this.parts(type, bindings, render, active)
        : [this.item(member, type, bindings, render)];
      if (spread && ts.isNamedTupleMember(member))
        for (const part of parts)
          if (!part.prefix.length && part.items !== false)
            part.items = tupleItem(part.items, member);
      const choices = parts.flatMap((part) =>
        this.expand(part, index < syntax.elements.length - 1, member),
      );
      if (rows.length * choices.length > 100)
        throw new SchemaError('Tuple spread expansion exceeds 100 alternatives', syntax);
      rows = rows.flatMap((row) =>
        choices.map((choice) => ({
          parts: [...row.parts, choice.part],
          positions: [...row.positions, choice.position],
          min: row.min + choice.part.min,
          max: row.max + choice.part.max,
        })),
      );
    });
    return rows;
  }

  private item(
    member: ts.TypeNode,
    syntax: ts.TypeNode,
    bindings: TypeBindings,
    render: Render,
  ): Segment {
    const type = this.projection.resolved(this.checker.getTypeFromTypeNode(syntax), bindings);
    let schema = render(type, syntax, bindings);
    schema = tupleItem(schema, ts.isNamedTupleMember(member) ? member : undefined);
    const optional =
      ts.isOptionalTypeNode(member) || (ts.isNamedTupleMember(member) && member.questionToken);
    return { prefix: [schema], items: false, min: optional ? 0 : 1, max: 1, constrained: false };
  }

  private parts(
    syntax: ts.TypeNode,
    bindings: TypeBindings,
    render: Render,
    active: Set<ts.Node>,
  ): Segment[] {
    if (active.has(syntax)) throw new SchemaError('Tuple spread origin is recursive', syntax);
    active.add(syntax);
    try {
      return this.collection(syntax, bindings, render, active);
    } finally {
      active.delete(syntax);
    }
  }

  private collection(
    syntax: ts.TypeNode,
    bindings: TypeBindings,
    render: Render,
    active: Set<ts.Node>,
  ): Segment[] {
    if (ts.isParenthesizedTypeNode(syntax))
      return this.parts(syntax.type, bindings, render, active);
    if (ts.isTypeOperatorNode(syntax) && syntax.operator === ts.SyntaxKind.ReadonlyKeyword)
      return this.parts(syntax.type, bindings, render, active);
    if (ts.isUnionTypeNode(syntax))
      return syntax.types.flatMap((part) => this.parts(part, bindings, render, active));
    const origin = bindings.origins?.get(this.checker.getTypeFromTypeNode(syntax));
    if (origin) return this.parts(origin.syntax, origin.bindings, render, active);
    const declaration = this.alias(syntax);
    if (declaration && (ts.isTypeReferenceNode(syntax) || ts.isImportTypeNode(syntax))) {
      const scopes = this.projection.bind(syntax, declaration, bindings);
      return this.bounds(this.parts(declaration.type, scopes, render, active), declaration);
    }
    if (ts.isTupleTypeNode(syntax))
      return this.rows(syntax, bindings, render, active).map((row) => this.segment(row, syntax));
    const type = this.projection.resolved(this.checker.getTypeFromTypeNode(syntax), bindings);
    const readonly =
      type.getSymbol()?.name === 'ReadonlyArray' &&
      type.getSymbol()?.declarations?.every((node) => node.getSourceFile().hasNoDefaultLib);
    if (!this.checker.isArrayType(type) && !readonly)
      throw new SchemaError(
        'Tuple spread requires an array or an explicit tuple annotation origin',
        syntax,
      );
    const item = this.checker.getTypeArguments(type as ts.TypeReference)[0];
    if (!item) throw new SchemaError('Tuple spread element type cannot be resolved', syntax);
    const element = ts.isArrayTypeNode(syntax)
      ? syntax.elementType
      : ts.isTypeReferenceNode(syntax)
        ? (syntax.typeArguments?.[0] ?? syntax)
        : syntax;
    return [
      {
        prefix: [],
        items: render(item, element, bindings),
        min: 0,
        max: Infinity,
        constrained: false,
      },
    ];
  }

  private alias(syntax: ts.TypeNode): ts.TypeAliasDeclaration | undefined {
    if (!(ts.isTypeReferenceNode(syntax) || ts.isImportTypeNode(syntax))) return undefined;
    let symbol = this.checker.getSymbolAtLocation(
      ts.isTypeReferenceNode(syntax) ? syntax.typeName : (syntax.qualifier ?? syntax),
    );
    if (symbol?.flags && symbol.flags & ts.SymbolFlags.Alias)
      symbol = this.checker.getAliasedSymbol(symbol);
    const declaration = symbol?.declarations?.find(ts.isTypeAliasDeclaration);
    return declaration?.getSourceFile().hasNoDefaultLib ? undefined : declaration;
  }

  private bounds(parts: Segment[], declaration: ts.TypeAliasDeclaration): Segment[] {
    if (
      ts
        .getJSDocTags(declaration)
        .some((tag) => ['jsonSchema', 'asType'].includes(tag.tagName.text))
    )
      throw new SchemaError(
        'Tuple spreads require collection length assertions, not serialization overrides',
        declaration,
      );
    const schema = annotate({}, declaration);
    if (typeof schema !== 'object')
      throw new SchemaError('Tuple spread annotations must describe a collection', declaration);
    for (const [name, value] of Object.entries(schema)) {
      if (SCHEMA_ANNOTATIONS.has(name) || name.startsWith('x-')) continue;
      if (!['minItems', 'maxItems'].includes(name))
        throw new SchemaError(`Tuple spread cannot preserve ${name}`, declaration);
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0)
        throw new SchemaError(
          'Tuple spread length bounds must be nonnegative integers',
          declaration,
        );
    }
    const min = schema.minItems as number | undefined;
    const max = schema.maxItems as number | undefined;
    return parts.map((part) => ({
      ...part,
      min: Math.max(part.min, min ?? 0),
      max: Math.min(part.max, max ?? Infinity),
      constrained: part.constrained || min !== undefined || max !== undefined,
    }));
  }

  private expand(
    part: Segment,
    followed: boolean,
    node: ts.Node,
  ): { part: Segment; position: Segment }[] {
    if (part.min > part.max) return [];
    if (!part.constrained || part.items !== false)
      return [{ part, position: part.position ?? part }];
    if (part.max - part.min + 1 > 100)
      throw new SchemaError('Tuple spread expansion exceeds 100 alternatives', node);
    return Array.from({ length: part.max - part.min + 1 }, (_, index) => {
      const length = part.min + index;
      const fixed = {
        ...part,
        prefix: part.prefix.slice(0, length),
        min: length,
        max: length,
        constrained: false,
      };
      return {
        part: fixed,
        position:
          length < part.prefix.length && followed
            ? { ...part, min: Math.min(part.min, part.prefix.length), max: part.prefix.length }
            : fixed,
      };
    });
  }

  private segment(row: Row, node: ts.Node): Segment {
    const shape = this.flatten(row.parts, row.min, row.max, node);
    if (typeof shape !== 'object')
      return { prefix: [], items: false, min: 1, max: 0, constrained: true };
    const segment: Segment = {
      prefix: (shape.prefixItems as Schema[] | undefined) ?? [],
      items: shape.items as Schema,
      min: row.min,
      max: row.max,
      constrained: row.parts.some((part) => part.constrained),
    };
    const positional = this.flatten(row.positions, row.min, row.max, node);
    if (typeof positional === 'object' && JSON.stringify(shape) !== JSON.stringify(positional))
      segment.position = {
        ...segment,
        prefix: (positional.prefixItems as Schema[] | undefined) ?? [],
        items: positional.items as Schema,
      };
    return segment;
  }

  private flatten(parts: Segment[], min: number, max: number, node: ts.Node): Schema {
    const prefix: Schema[] = [];
    let items: Schema = false;
    for (const part of parts) {
      if (items !== false && (part.prefix.length || part.items !== false))
        throw new SchemaError(
          'Tuple segments after an unbounded spread require an explicit model',
          node,
        );
      prefix.push(...part.prefix);
      if (part.items !== false) items = part.items;
    }
    return {
      type: 'array',
      ...(prefix.length ? { prefixItems: prefix } : {}),
      items,
      minItems: min,
      ...(Number.isFinite(max) ? { maxItems: max } : {}),
    };
  }
}
