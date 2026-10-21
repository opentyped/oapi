import ts from 'typescript';
import { parseRef } from '~/pointer';
import type { ParameterObject, ReferenceObject } from '~/types';

export const BOOLEAN = ts.factory.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword);
export const FALSE = ts.factory.createLiteralTypeNode(ts.factory.createFalse());
export const NEVER = ts.factory.createKeywordTypeNode(ts.SyntaxKind.NeverKeyword);
export const NULL = ts.factory.createLiteralTypeNode(ts.factory.createNull());
export const NUMBER = ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);
export const QUESTION_TOKEN = ts.factory.createToken(ts.SyntaxKind.QuestionToken);
export const STRING = ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
export const TRUE = ts.factory.createLiteralTypeNode(ts.factory.createTrue());
export const UNKNOWN = ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword);

const JS_PROPERTY_INDEX_RE = /^[A-Za-z_$][A-Za-z_$0-9]*$/;
const LINE_BREAK_RE = /\r?\n/g;
const COMMENT_END_RE = /\*\//g;

/** Print nodes with a stable layout; synthetic comments attached to nodes are kept. */
export function printAst(nodes: ts.Node[]): string {
  const statements = nodes.map((node) => {
    if (!ts.isStatement(node)) throw new Error('Definition output must contain statements');
    return node;
  });
  const sourceFile = ts.factory.createSourceFile(
    ts.factory.createNodeArray(statements),
    ts.factory.createToken(ts.SyntaxKind.EndOfFileToken),
    ts.NodeFlags.None,
  );
  const printer = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
    removeComments: false,
  });
  return printer.printFile(sourceFile);
}

/** Parse TypeScript source into statements; the caller asserts the expected shape. */
export function parseSnippet(source: string): readonly ts.Statement[] {
  return ts.createSourceFile(
    'snippet',
    source,
    ts.ScriptTarget.ESNext,
    /* setParentNodes */ undefined,
    ts.ScriptKind.TS,
  ).statements;
}

/** Fields that may become JSDoc annotations on a generated property. */
interface CommentSource {
  const?: unknown;
  default?: unknown;
  deprecated?: boolean;
  description?: unknown;
  enum?: unknown;
  example?: unknown;
  examples?: unknown;
  format?: string;
  nullable?: boolean;
  summary?: string;
  title?: string;
  type?: string | string[];
}

/**
 * Attach a `/** ... *\/` comment summarizing a schema object's annotations.
 * Without content the node is left untouched.
 */
export function jsdocComment(source: unknown, node: ts.PropertySignature): void {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return;
  const schema = source as CommentSource;
  const output: string[] = [];

  if (schema.title) output.push(schema.title.trim().replace(LINE_BREAK_RE, '\n *     '));
  if (schema.summary) output.push(schema.summary.trim().replace(LINE_BREAK_RE, '\n *     '));
  if (schema.format) output.push(`Format: ${schema.format}`);
  if (schema.deprecated) output.push('@deprecated');

  for (const field of ['description', 'default', 'example'] as const) {
    const value = schema[field];
    if (value === undefined) continue;
    if (value === '' && field !== 'default' && field !== 'example') continue;
    const serialized = typeof value === 'object' ? JSON.stringify(value, null, 2) : value;
    output.push(`@${field} ${String(serialized).trim().replace(LINE_BREAK_RE, '\n *     ')}`);
  }

  if (Array.isArray(schema.examples)) {
    for (const example of schema.examples) {
      const serialized = typeof example === 'object' ? JSON.stringify(example, null, 2) : example;
      output.push(`@example ${String(serialized).trim().replace(LINE_BREAK_RE, '\n *     ')}`);
    }
  }

  if ('const' in schema) output.push('@constant');

  if (schema.enum) {
    let type = 'unknown';
    if (Array.isArray(schema.type)) type = schema.type.join('|');
    else if (typeof schema.type === 'string') type = schema.type;
    output.push(`@enum {${type}${schema.nullable ? '|null' : ''}}`);
  }

  if (!output.length) return;

  const multiLine = output.length > 1 || output.some((item) => item.includes('\n'));
  const text = (multiLine ? `*\n * ${output.join('\n * ')}\n ` : `* ${output.join('\n')} `).replace(
    COMMENT_END_RE,
    '*\\/',
  );

  ts.addSyntheticLeadingComment(
    node,
    ts.SyntaxKind.MultiLineCommentTrivia,
    text,
    /* hasTrailingNewLine */ true,
  );
}

function indexedAccess(node: ts.TypeNode, segment: string): ts.IndexedAccessTypeNode {
  return ts.factory.createIndexedAccessTypeNode(
    node,
    ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(segment)),
  );
}

function isParameterObject(
  resolved: ParameterObject | ReferenceObject | undefined,
): resolved is ParameterObject {
  return Boolean(resolved && !('$ref' in resolved) && resolved.in);
}

/**
 * Turn a local `#/`-reference into an indexed access into the generated
 * interfaces, e.g. `components["schemas"]["Pet"]`.
 *
 * Generated types flatten schema `properties` and classify `parameters` by
 * location, so those pointer segments are folded away; a resolved parameter
 * reference contributes its `in` and `name` instead.
 */
export function refType(ref: string, resolved?: ParameterObject | ReferenceObject): ts.TypeNode {
  const { pointer } = parseRef(ref);
  if (pointer.length === 0) {
    throw new Error(`Error parsing $ref: ${ref}. Is this a valid $ref?`);
  }
  const parameter = isParameterObject(resolved);

  const [root, ...head] = pointer;
  const leading = head
    .splice(0, 2)
    .reduce(indexedAccess, ts.factory.createTypeReferenceNode(String(root)));

  return pointer.slice(3).reduce<ts.TypeNode>((access, segment, index, segments) => {
    // Generated types flatten `properties`; `content` media schemas keep only `schema`.
    if (segment === 'properties') return access;
    if (segment === 'schema' && segments[index - 2] === 'content') return access;
    if (parameter && index === segments.length - 1) {
      return indexedAccess(indexedAccess(access, resolved.in), resolved.name);
    }
    return indexedAccess(access, segment);
  }, leading);
}

/** Union of the given types; collapses empty and singleton lists. */
export function unionType(types: ts.TypeNode[]): ts.TypeNode {
  if (types.length === 0) return NEVER;
  if (types.length === 1) return types[0]!;
  return ts.factory.createUnionTypeNode(dedupePrimitives(types));
}

/** Intersection of the given types; collapses empty and singleton lists. */
export function intersectionType(types: ts.TypeNode[]): ts.TypeNode {
  if (types.length === 0) return NEVER;
  if (types.length === 1) return types[0]!;
  return ts.factory.createIntersectionTypeNode(dedupePrimitives(types));
}

/** Append `| null` to every variant. */
export function nullableType(types: ts.TypeNode[]): ts.TypeNode {
  return ts.factory.createUnionTypeNode([...types, NULL]);
}

/** `Omit<type, keys>` */
export function omitType(type: ts.TypeNode, keys: string[]): ts.TypeNode {
  return ts.factory.createTypeReferenceNode('Omit', [
    type,
    ts.factory.createUnionTypeNode(keys.map((key) => literalType(key))),
  ]);
}

/** `Record<key, value>` */
export function recordType(key: ts.TypeNode, value: ts.TypeNode): ts.TypeNode {
  return ts.factory.createTypeReferenceNode('Record', [key, value]);
}

/**
 * `WithRequired<type, keys>`; the helper alias is injected into the footer
 * nodes the first time it is needed.
 */
export function withRequiredType(
  type: ts.TypeNode,
  keys: string[],
  injectFooter: ts.Node[],
): ts.TypeNode {
  if (keys.length === 0) return type;
  if (!injectFooter.some(isHelperAlias('WithRequired'))) {
    injectFooter.push(
      parseSnippet(
        'type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] };',
      )[0] as ts.TypeAliasDeclaration,
    );
  }
  return ts.factory.createTypeReferenceNode('WithRequired', [
    type,
    unionType(keys.map((key) => literalType(key))),
  ]);
}

function isHelperAlias(name: string): (node: ts.Node) => boolean {
  return (node): boolean => ts.isTypeAliasDeclaration(node) && node.name.escapedText === name;
}

/** Modifiers for generated declarations. */
export function modifiers(options: { readonly?: boolean; export?: boolean }): ts.Modifier[] {
  const result: ts.Modifier[] = [];
  if (options.export) result.push(ts.factory.createModifier(ts.SyntaxKind.ExportKeyword));
  if (options.readonly) result.push(ts.factory.createModifier(ts.SyntaxKind.ReadonlyKeyword));
  return result;
}

/** Property name: identifiers where valid, numeric literals for array indices. */
export function propertyIndex(index: string | number): ts.PropertyName {
  if (
    (typeof index === 'number' && !(index < 0)) ||
    (typeof index === 'string' && String(Number(index)) === index && index[0] !== '-')
  ) {
    return ts.factory.createNumericLiteral(index);
  }
  if (typeof index === 'string' && JS_PROPERTY_INDEX_RE.test(index)) {
    return ts.factory.createIdentifier(index);
  }
  return ts.factory.createStringLiteral(String(index));
}

/** Literal type for a JSON value; objects become type literals, tuples become tuple types. */
export function literalType(value: unknown, immutable = false): ts.TypeNode {
  if (typeof value === 'string') {
    const literal = ts.factory.createStringLiteral(value);
    ts.setEmitFlags(literal, ts.EmitFlags.NoAsciiEscaping);
    return ts.factory.createLiteralTypeNode(literal);
  }
  if (typeof value === 'number') {
    const literal =
      value < 0
        ? ts.factory.createPrefixUnaryExpression(
            ts.SyntaxKind.MinusToken,
            ts.factory.createNumericLiteral(Math.abs(value)),
          )
        : ts.factory.createNumericLiteral(value);
    return ts.factory.createLiteralTypeNode(literal);
  }
  if (typeof value === 'boolean') return value ? TRUE : FALSE;
  if (value === null) return NULL;
  if (Array.isArray(value)) {
    const tuple = ts.factory.createTupleTypeNode(
      value.map((item: unknown) => literalType(item, immutable)),
    );
    return immutable
      ? ts.factory.createTypeOperatorNode(ts.SyntaxKind.ReadonlyKeyword, tuple)
      : tuple;
  }
  if (typeof value === 'object') {
    const members: ts.TypeElement[] = [];
    for (const [key, item] of Object.entries(value)) {
      members.push(
        ts.factory.createPropertySignature(
          modifiers({ readonly: immutable }),
          propertyIndex(key),
          /* questionToken */ undefined,
          literalType(item, immutable),
        ),
      );
    }
    if (members.length) return ts.factory.createTypeLiteralNode(members);
    const empty = recordType(STRING, NEVER);
    return immutable ? ts.factory.createTypeReferenceNode('Readonly', [empty]) : empty;
  }
  return UNKNOWN;
}

/** Drop duplicate primitives while preserving literals and complex types. */
function dedupePrimitives(types: ts.TypeNode[]): ts.TypeNode[] {
  const encountered = new Set<number>();
  const result: ts.TypeNode[] = [];
  for (const type of types) {
    const target = ts.isLiteralTypeNode(type) ? type.literal : type;
    if (!('text' in target)) {
      if (encountered.has(target.kind)) continue;
      if (isPrimitive(target)) encountered.add(target.kind);
    }
    result.push(type);
  }
  return result;
}

/** Primitives carry no structure, so duplicates collapse harmlessly. */
function isPrimitive(type: ts.Node): boolean {
  if (
    type.kind === ts.SyntaxKind.BooleanKeyword ||
    type.kind === ts.SyntaxKind.NeverKeyword ||
    type.kind === ts.SyntaxKind.NullKeyword ||
    type.kind === ts.SyntaxKind.NumberKeyword ||
    type.kind === ts.SyntaxKind.StringKeyword ||
    type.kind === ts.SyntaxKind.UndefinedKeyword
  ) {
    return true;
  }
  return ts.isLiteralTypeNode(type) && isPrimitive(type.literal);
}

export function propertyText(name: ts.PropertyName): string {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name))
    return name.text;
  return '';
}

/** Resolves generated type aliases and indexed accesses without a second TypeScript program. */
export class TypeDeclarations {
  private readonly declarations = new Map<string, ts.Node>();

  constructor(nodes: readonly ts.Node[]) {
    for (const node of nodes) {
      if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node))
        this.declarations.set(node.name.text, node);
    }
  }

  property(node: ts.Node | undefined, name: string): ts.PropertySignature | undefined {
    return this.members(node).find((member) => propertyText(member.name) === name);
  }

  members(node: ts.Node | string | undefined, active = new Set<ts.Node>()): ts.PropertySignature[] {
    if (typeof node === 'string') node = this.declarations.get(node);
    if (!node) return [];
    if (active.has(node)) throw new Error('Circular generated type structure.');
    const visited = new Set(active).add(node);
    if (ts.isInterfaceDeclaration(node) || ts.isTypeLiteralNode(node))
      return node.members.filter(ts.isPropertySignature);
    if (ts.isTypeAliasDeclaration(node)) return this.members(node.type, visited);
    if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName))
      return this.members(node.typeName.text, visited);
    if (!ts.isIndexedAccessTypeNode(node) || !ts.isLiteralTypeNode(node.indexType)) return [];
    const index = node.indexType.literal;
    if (!ts.isStringLiteral(index) && !ts.isNumericLiteral(index)) return [];
    const property = this.members(node.objectType, visited).find(
      (member) => propertyText(member.name) === index.text,
    );
    return this.members(property?.type, visited);
  }
}
