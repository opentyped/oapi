import ts from 'typescript';
import { templatePattern } from '@opentyped/oapi-ast/pattern';
import JSON5 from 'json5';
import { validateJson } from '@opentyped/oapi-openapi/json';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { specificationExtensions, record } from '@opentyped/oapi-openapi/document/metadata';
import { operationAnnotations } from '@opentyped/oapi-openapi/document/definition';
import { documentationOf } from '@opentyped/oapi-ast/jsdoc';
import { SchemaResource } from '@opentyped/oapi-openapi/schema/resource';
import { SCHEMA_ANNOTATIONS } from '@opentyped/oapi-openapi/schema/graph';
import { xmlAnnotations } from '@opentyped/oapi-openapi/schema/validation';
import { visitSchema } from '@opentyped/oapi-openapi/schema/visitor';
import type { Source } from '@opentyped/oapi-openapi/diagnostic';
import type { Schema as ResourceSchema } from '@opentyped/oapi-openapi/schema/definition';
import type { Schema, SchemaDocument } from '~/definition';
import { SchemaError } from '~/error';
import { queryOrigin } from '~/query';
import { fieldName, modelRule } from '~/property';
import type { TypeBindings } from '~/projection';

const numbers = new Set([
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'minLength',
  'maxLength',
  'minItems',
  'maxItems',
  'minProperties',
  'maxProperties',
]);
const strings = new Set([
  'format',
  'pattern',
  'title',
  'description',
  'contentEncoding',
  'contentMediaType',
]);
const metadata = new Set([...operationAnnotations, 'schema', 'schemaName', 'response']);

function tagText(tag: ts.JSDocTag): string {
  return (
    typeof tag.comment === 'string'
      ? tag.comment
      : (tag.comment?.map((part) => part.text).join('') ?? '')
  ).trim();
}

function jsonValue(text: string, node: ts.Node): unknown {
  return JSON.parse(text, (_key, value: unknown) => {
    if (typeof value === 'number' && !Number.isFinite(value))
      throw new SchemaError('JSON annotation numbers must be finite', node);
    return value;
  }) as unknown;
}

function annotationSource(node: ts.Node): Source {
  return {
    location: node.getSourceFile().fileName,
    fail(message): never {
      throw new SchemaError(message, node);
    },
  };
}

/** Presence belongs to the field, rather than its selected value's schema. */
export function fieldRequired(node: ts.Node | undefined): boolean | undefined {
  if (
    !node ||
    !(ts.isPropertySignature(node) || ts.isPropertyDeclaration(node) || ts.isParameter(node))
  )
    return undefined;
  const tags = ts.getJSDocTags(node).filter((tag) => tag.tagName.text === 'required');
  if (tags.length > 1) throw new SchemaError('Duplicate @required annotation', node);
  if (!tags.length) return undefined;
  const text = tagText(tags[0]!);
  if (text.startsWith('[')) return undefined;
  if (!['', 'true', 'false'].includes(text))
    throw new SchemaError(
      'Field @required requires a flag, true, false or a required-name array',
      node,
    );
  return text !== 'false';
}

const validator = new Ajv2020({ strict: false, allErrors: true, validateFormats: false });

/** Register resource identities without compiling or fetching external references. */
export function validateResources(document: SchemaDocument): void {
  new SchemaResource(document as ResourceSchema, 'standalone').validate();
}

/** An explicit wire schema replaces type inference, including intentionally opaque values. */
function explicitSchema(node: ts.Node): Schema | undefined {
  const tags = ts
    .getJSDocTags(node)
    .filter((tag) => ['jsonSchema', 'asType', 'ref'].includes(tag.tagName.text));
  if (!tags.length) return undefined;
  if (tags.length !== 1)
    throw new SchemaError(
      tags.every((tag) => tag.tagName.text === tags[0]!.tagName.text)
        ? `Duplicate @${tags[0]!.tagName.text} annotation`
        : 'Conflicting serialization annotations',
      node,
    );
  const tag = tags[0]!;
  const text = tagText(tag);
  if (tag.tagName.text === 'ref') {
    if (!text || /\s/.test(text))
      throw new SchemaError('@ref requires a schema URI reference without whitespace', tag);
    return { $ref: text };
  }
  if (tag.tagName.text === 'asType') {
    const type = text?.trim();
    if (
      !type ||
      !['string', 'number', 'integer', 'boolean', 'null', 'object', 'array'].includes(type)
    )
      throw new SchemaError('@asType requires a JSON Schema type', tag);
    return { type };
  }
  return schemaValue(text, tag, 'jsonSchema');
}

/** Validate schema-valued annotations with the same dialect as explicit wire schemas. */
function schemaValue(text: string, tag: ts.JSDocTag, name: string): Schema {
  let value: unknown;
  try {
    value = jsonValue(text, tag);
  } catch {
    throw new SchemaError(`@${name} requires JSON`, tag);
  }
  if (typeof value !== 'boolean' && (!value || typeof value !== 'object' || Array.isArray(value)))
    throw new SchemaError(`@${name} requires a JSON Schema object or boolean`, tag);
  try {
    if (!validator.validateSchema(value as object | boolean))
      throw new Error(validator.errorsText());
    const xml: unknown[] = [];
    visitSchema(value as ResourceSchema, (schema) => {
      if (typeof schema === 'object' && schema.xml !== undefined) xml.push(schema.xml);
    });
    xmlAnnotations(xml, annotationSource(tag));
  } catch (error) {
    throw new SchemaError(
      `Invalid @${name}: ${error instanceof Error ? error.message : String(error)}`,
      tag,
    );
  }
  return value as Schema;
}

export interface OverrideOrigin {
  syntax: ts.TypeNode;
  resolve: (syntax: ts.TypeNode) => OverrideOrigin | undefined;
}

export function overrideResolver(
  checker: ts.TypeChecker,
  bindings: TypeBindings,
): (syntax: ts.TypeNode) => OverrideOrigin | undefined {
  return (syntax) => {
    const origin = bindings.origins?.get(checker.getTypeFromTypeNode(syntax));
    return origin && { syntax: origin.syntax, resolve: overrideResolver(checker, origin.bindings) };
  };
}

/** Follow explicit alias edges before TypeChecker erases primitive alias identity. */
export function schemaOverride(
  node: ts.Node,
  checker: ts.TypeChecker,
  seen = new Set<ts.Node>(),
  materialize?: (schema: Schema, declaration: ts.Node) => Schema,
  resolve?: (syntax: ts.TypeNode) => OverrideOrigin | undefined,
): Schema | undefined {
  if (seen.has(node)) return undefined;
  seen.add(node);
  const direct = explicitSchema(node);
  if (direct !== undefined) {
    const schema = annotate(direct, node);
    const field =
      ts.isPropertySignature(node) || ts.isPropertyDeclaration(node) || ts.isParameter(node);
    let resource = false;
    if (field)
      visitSchema(schema as ResourceSchema, (value) => {
        if (
          typeof value === 'object' &&
          ['$id', '$anchor', '$dynamicAnchor'].some((key) => key in value)
        )
          resource = true;
      });
    const inline =
      field && (!resource || ts.getJSDocTags(node).some((tag) => tag.tagName.text === 'ref'));
    return materialize && !inline ? materialize(schema, node) : schema;
  }
  let syntax = ts.isTypeNode(node)
    ? node
    : ts.isTypeAliasDeclaration(node) ||
        ts.isPropertySignature(node) ||
        ts.isPropertyDeclaration(node) ||
        ts.isVariableDeclaration(node) ||
        ts.isParameter(node)
      ? node.type
      : undefined;
  while (
    syntax &&
    (ts.isParenthesizedTypeNode(syntax) ||
      (ts.isTypeOperatorNode(syntax) && syntax.operator === ts.SyntaxKind.ReadonlyKeyword))
  )
    syntax = syntax.type;
  if (syntax && ts.getJSDocTags(node).some((tag) => tag.tagName.text === 'pattern')) {
    const type = checker.getTypeFromTypeNode(syntax);
    const parts = type.isUnion() ? type.types : [type];
    if (
      parts.every((part) => part.flags & (ts.TypeFlags.TemplateLiteral | ts.TypeFlags.Null)) &&
      parts.some(
        (part) => part.flags & ts.TypeFlags.TemplateLiteral && templatePattern(part) === undefined,
      )
    ) {
      // Resolve an explicit wire pattern before the shared type cache; it belongs to this source.
      const nullable = parts.some((part) => part.flags & ts.TypeFlags.Null);
      const schema = annotate({ type: nullable ? ['string', 'null'] : 'string' }, node);
      return materialize && ts.isTypeAliasDeclaration(node) ? materialize(schema, node) : schema;
    }
  }
  if (syntax && ts.isUnionTypeNode(syntax)) {
    const alternatives = syntax.types.map((part) => {
      if (ts.isLiteralTypeNode(part) && part.literal.kind === ts.SyntaxKind.NullKeyword)
        return { type: 'null' };
      return schemaOverride(part, checker, new Set(seen), materialize, resolve);
    });
    if (alternatives.every((part) => part !== undefined))
      return annotate({ anyOf: alternatives }, node);
    // A partial override must never erase the remaining union alternatives.
    return undefined;
  }
  if (syntax && (ts.isTypeQueryNode(syntax) || (ts.isImportTypeNode(syntax) && syntax.isTypeOf))) {
    const origin = queryOrigin(syntax, checker);
    return origin ? schemaOverride(origin, checker, seen, materialize, resolve) : undefined;
  }
  if (syntax && ts.isArrayTypeNode(syntax)) {
    const element = schemaOverride(syntax.elementType, checker, seen, materialize, resolve);
    return element === undefined ? undefined : annotate({ type: 'array', items: element }, node);
  }
  if (!syntax || !(ts.isTypeReferenceNode(syntax) || ts.isImportTypeNode(syntax))) return undefined;
  const captured = resolve?.(syntax);
  if (captured) {
    const inherited = schemaOverride(captured.syntax, checker, seen, materialize, captured.resolve);
    return inherited === undefined ? undefined : annotate(inherited, node);
  }
  let symbol = checker.getSymbolAtLocation(
    ts.isTypeReferenceNode(syntax) ? syntax.typeName : (syntax.qualifier ?? syntax),
  );
  if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
  const declaration = symbol?.declarations?.find(
    (item) =>
      ts.isTypeAliasDeclaration(item) ||
      ts.isInterfaceDeclaration(item) ||
      ts.isClassDeclaration(item) ||
      ts.isEnumDeclaration(item),
  );
  if (!declaration) return undefined;
  if (declaration.getSourceFile().hasNoDefaultLib) {
    if (symbol?.name === 'Readonly' && syntax.typeArguments?.length === 1) {
      const inherited = schemaOverride(
        syntax.typeArguments[0]!,
        checker,
        seen,
        materialize,
        resolve,
      );
      return inherited === undefined ? undefined : annotate(inherited, node);
    }
    if (
      (symbol?.name === 'Array' || symbol?.name === 'ReadonlyArray') &&
      syntax.typeArguments?.length === 1
    ) {
      const element = schemaOverride(syntax.typeArguments[0]!, checker, seen, materialize, resolve);
      return element === undefined ? undefined : annotate({ type: 'array', items: element }, node);
    }
    return undefined;
  }
  const inherited = schemaOverride(declaration, checker, seen, materialize, resolve);
  return inherited === undefined ? undefined : annotate(inherited, node);
}

/** Unsupported schema annotations fail rather than silently producing a weaker contract. */
export function annotate(schema: Schema, node: ts.Node, projected = false): Schema {
  if (node.getSourceFile().hasNoDefaultLib) return schema;
  let nullable = false;
  const constraints: Record<string, unknown> = {};
  let annotations: Record<string, unknown> = {};
  const description = documentationOf(node);
  if (description) annotations.description = description;
  for (const tag of ts.getJSDocTags(node)) {
    const name = tag.tagName.text;
    const text = tagText(tag);
    if (name === 'required') {
      if (!text.startsWith('[')) {
        if (fieldRequired(node) === undefined)
          throw new SchemaError('@required requires a JSON array of property names on models', tag);
        continue;
      }
      let names: unknown;
      try {
        names = jsonValue(text, tag);
      } catch {
        throw new SchemaError('@required requires a JSON array of property names', tag);
      }
      if (
        !Array.isArray(names) ||
        !names.every((name: unknown) => typeof name === 'string') ||
        new Set(names).size !== names.length
      )
        throw new SchemaError('@required requires unique string property names', tag);
      constraints.required = names;
      continue;
    }
    if (name === 'http') {
      let value: unknown;
      try {
        value = jsonValue(text, tag);
      } catch {
        throw new SchemaError('@http requires a JSON object', tag);
      }
      annotations.http = record(value, annotationSource(tag), 'HTTP metadata');
      continue;
    }
    if (name === 'discriminator') {
      if (!text) throw new SchemaError('@discriminator requires a property name', tag);
      annotations.discriminator = text;
      continue;
    }
    if (name === 'xml') {
      let value: unknown;
      try {
        value = jsonValue(text, tag);
      } catch {
        throw new SchemaError('@xml requires a JSON object', tag);
      }
      xmlAnnotations([value], annotationSource(tag));
      annotations.xml = value;
      continue;
    }
    if (name === 'inline') {
      if (text && text !== 'true' && text !== 'false')
        throw new SchemaError('@inline requires true or false', tag);
      annotations.inline = text !== 'false';
      continue;
    }
    if (name === 'contentSchema') {
      annotations.contentSchema = schemaValue(text, tag, name);
      continue;
    }
    if (name === 'extensions') {
      let value: unknown;
      try {
        value = jsonValue(text, tag);
      } catch (error) {
        if (error instanceof SchemaError) throw error;
        throw new SchemaError('@extensions requires a JSON object', tag);
      }
      annotations = {
        ...annotations,
        ...specificationExtensions(value, annotationSource(tag)),
      };
      continue;
    }
    if (name === 'const') {
      if (!text) throw new SchemaError('@const requires a JSON value or string', tag);
      try {
        constraints.const = jsonValue(text, tag);
      } catch (error) {
        if (error instanceof SchemaError) throw error;
        constraints.const = text;
      }
      continue;
    }
    if (name === 'namespace') {
      throw new SchemaError(
        '@namespace is unsupported; configure SchemaOptions.namespaces instead',
        tag,
      );
    }
    if (name === 'jsonSchema' || name === 'asType' || name === 'ref') continue;
    if (name === 'nullable') {
      if (text && text !== 'true' && text !== 'false')
        throw new SchemaError('@nullable requires true or false', tag);
      nullable = text !== 'false';
      continue;
    }
    if (projected && name === 'rename') continue;
    if (name === 'rename' || name === 'renameAll') {
      fieldName(node);
      modelRule(node);
      continue;
    }
    if (metadata.has(name)) {
      if (name === 'schema' && text)
        throw new SchemaError('@schema arguments are unsupported', tag);
      if (name === 'schemaName' && !text) throw new SchemaError('@schemaName requires a name', tag);
      continue;
    }
    if (numbers.has(name)) {
      const value = Number(text);
      if (!text || !Number.isFinite(value))
        throw new SchemaError(`@${name} requires a finite number`, tag);
      if (
        (name.startsWith('min') || name.startsWith('max')) &&
        name !== 'minimum' &&
        name !== 'maximum' &&
        (!Number.isSafeInteger(value) || value < 0)
      ) {
        throw new SchemaError(`@${name} requires a nonnegative safe integer`, tag);
      }
      if (name === 'multipleOf' && value <= 0)
        throw new SchemaError('@multipleOf requires a positive number', tag);
      constraints[name] = value;
    } else if (strings.has(name)) {
      (SCHEMA_ANNOTATIONS.has(name) ? annotations : constraints)[name] = text;
    } else if (
      name === 'deprecated' ||
      name === 'readOnly' ||
      name === 'writeOnly' ||
      name === 'uniqueItems'
    ) {
      if (text && text !== 'true' && text !== 'false' && name !== 'deprecated') {
        throw new SchemaError(`@${name} requires true or false`, tag);
      }
      (SCHEMA_ANNOTATIONS.has(name) ? annotations : constraints)[name] = text !== 'false';
    } else if (name === 'default' || name === 'example' || name === 'examples') {
      try {
        const value: unknown = name === 'example' ? JSON5.parse(text) : jsonValue(text, tag);
        if (name === 'example') validateJson(value, 'Example');
        if (name === 'examples' && !Array.isArray(value)) {
          throw new SchemaError('@examples requires a JSON array', tag);
        }
        if (name === 'default') annotations.default = value;
        else {
          const previous = Array.isArray(annotations.examples) ? annotations.examples : [];
          annotations.examples = [
            ...previous,
            ...(name === 'example' ? [value] : (value as unknown[])),
          ];
        }
      } catch (error) {
        if (error instanceof SchemaError) throw error;
        throw new SchemaError(
          `@${name} requires JSON${name === 'example' ? ' or JSON5' : ''}: ${error instanceof Error ? error.message : String(error)}`,
          tag,
        );
      }
    } else {
      throw new SchemaError(`Unsupported schema annotation @${name}`, tag);
    }
  }
  const explicit = explicitSchema(node);
  let value = explicit ?? schema;
  if (Object.keys(annotations).length) {
    value =
      typeof value === 'boolean'
        ? { ...(value ? {} : { not: {} }), ...annotations }
        : { ...value, ...annotations, ...(typeof explicit === 'object' ? explicit : {}) };
  }
  if (Object.keys(constraints).length) {
    if (
      typeof value === 'object' &&
      Array.isArray(value.required) &&
      Array.isArray(constraints.required)
    ) {
      const required: unknown[] = [...constraints.required, ...value.required];
      value = { ...value, required: [...new Set(required)] };
      delete constraints.required;
    }
    const current = value;
    const conflicts =
      typeof current === 'object' &&
      Object.keys(constraints).some(
        (key) =>
          Object.hasOwn(current, key) &&
          JSON.stringify(current[key]) !== JSON.stringify(constraints[key]),
      );
    value =
      typeof value === 'boolean' || conflicts
        ? { allOf: [value], ...constraints }
        : { ...value, ...constraints };
  }
  if (!nullable) return value;
  if (value === false) return { type: 'null' };
  if (
    typeof value === 'object' &&
    Array.isArray(value.anyOf) &&
    value.anyOf.some(
      (branch: unknown) =>
        branch !== null && typeof branch === 'object' && 'type' in branch && branch.type === 'null',
    )
  )
    return value;
  const unionMetadata =
    typeof value === 'object'
      ? Object.fromEntries(
          Object.entries(value).filter(
            ([key]) => SCHEMA_ANNOTATIONS.has(key) || key.startsWith('x-'),
          ),
        )
      : {};
  return { ...unionMetadata, anyOf: [value, { type: 'null' }] };
}
