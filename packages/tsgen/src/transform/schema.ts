import ts from 'typescript';
import { createRef, localReference } from '~/pointer';
import {
  BOOLEAN,
  intersectionType,
  jsdocComment,
  literalType,
  modifiers,
  NEVER,
  NULL,
  NUMBER,
  nullableType,
  omitType,
  propertyIndex,
  QUESTION_TOKEN,
  recordType,
  refType,
  STRING,
  unionType,
  UNKNOWN,
  withRequiredType,
} from '~/ast';
import { getEntries } from '~/resolve';
import { discriminatorProperty } from '~/discriminate';
import type { Context } from '~/context';
import type { ArraySubtype, ReferenceObject, SchemaObject } from '~/types';

type SchemaInput = SchemaObject | ReferenceObject | boolean;

/**
 * Transform a Schema Object (or boolean schema) into a type node.
 * @see https://spec.openapis.org/oas/v3.2.0#schema-object
 */
export function schemaType(schema: SchemaInput, ctx: Context, path: string): ts.TypeNode {
  // Missing and falsy schemas serialize nothing.
  if (!schema) return NEVER;
  if (
    typeof schema === 'object' &&
    'not' in schema &&
    schema.not &&
    !Object.keys(schema.not).length
  ) {
    return NEVER;
  }
  // `true` accepts anything; `false` was handled above.
  if (schema === true) return UNKNOWN;
  if (Array.isArray(schema) || typeof schema !== 'object') {
    throw new Error(
      `Expected SchemaObject, received ${Array.isArray(schema) ? 'Array' : typeof schema} at ${path}`,
    );
  }

  if ('$ref' in schema) {
    const { $ref, ...siblings } = schema;
    const reference = localReference($ref, ctx.documentUri);
    const alias = ctx.schemaAliases.get(reference);
    let referenced = alias ? ts.factory.createTypeReferenceNode(alias) : refType(reference);
    const rest = siblings as unknown as SchemaObject;
    if (rest.required?.length) {
      const resolved = ctx.resolve<SchemaObject>($ref);
      const required = rest.required.filter(
        (key) =>
          resolved &&
          'properties' in resolved &&
          resolved.properties &&
          Object.hasOwn(resolved.properties, key),
      );
      if (required.length) {
        referenced = withRequiredType(referenced, required, ctx.injectFooter);
      }
    }
    const constraints = schemaType(rest, ctx, path);
    return constraints === UNKNOWN ? referenced : intersectionType([referenced, constraints]);
  }

  // Literal assertions hold alongside the remaining schema constraints.
  if (Object.hasOwn(schema, 'const')) {
    const { const: value, ...rest } = schema;
    const literal = literalType(value, ctx.immutable);
    const constraints = schemaType(rest as SchemaObject, ctx, path);
    return constraints === UNKNOWN ? literal : intersectionType([literal, constraints]);
  }
  if (Array.isArray(schema.enum)) {
    const { enum: values, ...rest } = schema;
    const literals = unionType(
      (values as unknown[]).map((value) => literalType(value, ctx.immutable)),
    );
    const constraints = schemaType(rest as SchemaObject, ctx, path);
    return constraints === UNKNOWN ? literals : intersectionType([literals, constraints]);
  }

  let finalType: ts.TypeNode | undefined;

  const core = objectCore(schema, ctx, path);
  const allOfTypes = allOfMembers(schema.allOf ?? [], schema.required, ctx, path);
  if (core || allOfTypes.length) {
    const allOf = allOfTypes.length ? intersectionType(allOfTypes) : undefined;
    finalType = intersectionType([...(core ? [core] : []), ...(allOf ? [allOf] : [])]);
  }
  // Alternatives satisfy the surrounding schema as well as their own constraints.
  const anyOfTypes = unionMembers(schema.anyOf ?? [], 'anyOf', ctx, path);
  if (anyOfTypes.length) {
    finalType = intersectionType([...(finalType ? [finalType] : []), unionType(anyOfTypes)]);
  }
  const oneOfTypes = unionMembers(schema.oneOf ?? [], 'oneOf', ctx, path);
  if (oneOfTypes.length) {
    finalType = intersectionType([...(finalType ? [finalType] : []), unionType(oneOfTypes)]);
  }

  if (!finalType) {
    finalType = 'type' in schema && schema.type ? recordType(STRING, UNKNOWN) : UNKNOWN;
  }
  if (finalType !== UNKNOWN && schema.nullable) {
    finalType = nullableType([finalType]);
  }
  return finalType;
}

/** Transform `anyOf`/`oneOf` items, threading indexed paths for stable naming. */
function unionMembers(
  items: (SchemaObject | ReferenceObject)[],
  key: 'anyOf' | 'oneOf',
  ctx: Context,
  path: string,
): ts.TypeNode[] {
  const output: ts.TypeNode[] = [];
  for (const [index, item] of items.entries()) {
    output.push(schemaType(item, ctx, createRef([path, key, String(index)])));
  }
  return output;
}

/**
 * Transform `allOf` items. Referenced objects pick up enclosing `required`
 * keys through `WithRequired<>`; discriminator properties are omitted because
 * the parent re-adds them as a literal.
 */
function allOfMembers(
  items: (SchemaObject | ReferenceObject)[],
  required: string[] | undefined,
  ctx: Context,
  path: string,
): ts.TypeNode[] {
  const output: ts.TypeNode[] = [];
  for (const item of items) {
    if (typeof item === 'boolean') {
      output.push(schemaType(item, ctx, path));
      continue;
    }
    let itemType: ts.TypeNode;
    if ('$ref' in item) {
      itemType = schemaType(item, ctx, path);
      const resolved = ctx.resolve<SchemaObject>(item.$ref);
      if (
        resolved &&
        typeof resolved === 'object' &&
        'properties' in resolved &&
        !ctx.discriminators.refsHandled.includes(item.$ref)
      ) {
        const validRequired = (required ?? []).filter((key) => Boolean(resolved.properties?.[key]));
        if (validRequired.length) {
          itemType = withRequiredType(itemType, validRequired, ctx.injectFooter);
        }
      }
    } else {
      const itemRequired = [...(required ?? [])];
      if (Array.isArray(item.required)) itemRequired.push(...item.required);
      itemType = schemaType({ ...item, required: itemRequired } as SchemaObject, ctx, path);
    }

    const discriminator =
      '$ref' in item ? ctx.discriminators.objects[item.$ref] : item.discriminator;
    output.push(discriminator ? omitType(itemType, [discriminator.propertyName]) : itemType);
  }
  return output;
}

/** Schema Object without composition keywords. */
function objectCore(schema: SchemaObject, ctx: Context, path: string): ts.TypeNode | undefined {
  if ('type' in schema && schema.type) {
    if (schema.type === 'null') return NULL;
    if (schema.type === 'string') return STRING;
    if (schema.type === 'number' || schema.type === 'integer') return NUMBER;
    if (schema.type === 'boolean') return BOOLEAN;
    if (schema.type === 'array') return arrayCore(schema, ctx, path);
    if (Array.isArray(schema.type)) return typeListCore(schema, schema.type, ctx, path);
  }
  return objectMembers(schema, ctx, path);
}

/** `type: array`, including tuple shapes from `prefixItems`/`items`. */
function arrayCore(
  schema: SchemaObject & Pick<ArraySubtype, 'prefixItems' | 'items' | 'minItems' | 'maxItems'>,
  ctx: Context,
  path: string,
): ts.TypeNode {
  let itemType: ts.TypeNode = UNKNOWN;
  let tuple = Boolean(schema.prefixItems || Array.isArray(schema.items));

  if (tuple) {
    const prefixItems = schema.prefixItems ?? (schema.items as (SchemaObject | ReferenceObject)[]);
    const minimum = schema.minItems ?? 0;
    const maximum = schema.maxItems ?? prefixItems.length;
    if (schema.maxItems !== undefined && minimum > schema.maxItems) return NEVER;
    const elements: ts.TypeNode[] = prefixItems.slice(0, maximum).map((item, index) => {
      const value = schemaType(item, ctx, path);
      return index < minimum ? value : ts.factory.createOptionalTypeNode(value);
    });
    if (schema.maxItems === undefined || schema.maxItems > prefixItems.length) {
      const rest =
        schema.items === undefined ? UNKNOWN : schemaType(schema.items as SchemaObject, ctx, path);
      if (rest.kind === ts.SyntaxKind.NeverKeyword) {
        if (minimum > prefixItems.length) return NEVER;
      } else {
        const finite = schema.maxItems !== undefined && maximum <= 30;
        const length = finite ? maximum : Math.min(minimum, 30);
        for (let index = prefixItems.length; index < length; index++) {
          elements.push(index < minimum ? rest : ts.factory.createOptionalTypeNode(rest));
        }
        if (!finite) {
          elements.push(ts.factory.createRestTypeNode(ts.factory.createArrayTypeNode(rest)));
        }
      }
    }
    itemType = ts.factory.createTupleTypeNode(elements);
  } else if (schema.items !== undefined && !Array.isArray(schema.items)) {
    itemType = schemaType(schema.items, ctx, path);
  }

  if (!tuple) {
    const minimum = schema.minItems ?? 0;
    const maximum = schema.maxItems;
    if (maximum !== undefined && minimum > maximum) return NEVER;
    if (itemType.kind === ts.SyntaxKind.NeverKeyword && minimum > 0) return NEVER;
    const finite = maximum !== undefined && maximum <= 30;
    if (finite || minimum > 0 || itemType.kind === ts.SyntaxKind.NeverKeyword) {
      const elements: ts.TypeNode[] = [];
      const length =
        itemType.kind === ts.SyntaxKind.NeverKeyword ? 0 : finite ? maximum : Math.min(minimum, 30);
      for (let index = 0; index < length; index++) {
        elements.push(index < minimum ? itemType : ts.factory.createOptionalTypeNode(itemType));
      }
      if (!finite && itemType.kind !== ts.SyntaxKind.NeverKeyword) {
        elements.push(ts.factory.createRestTypeNode(ts.factory.createArrayTypeNode(itemType)));
      }
      itemType = ts.factory.createTupleTypeNode(elements);
      tuple = true;
    }
  }

  const finalType = tuple ? itemType : ts.factory.createArrayTypeNode(itemType);
  return ctx.immutable
    ? ts.factory.createTypeOperatorNode(ts.SyntaxKind.ReadonlyKeyword, finalType)
    : finalType;
}

/** Polymorphic `type: [...]` lists, deduplicated against sibling `oneOf`. */
function typeListCore(
  schema: SchemaObject,
  types: string[],
  ctx: Context,
  path: string,
): ts.TypeNode {
  const uniqueTypes: ts.TypeNode[] = [];
  const covered = (type: string): boolean =>
    Array.isArray(schema.oneOf) &&
    schema.oneOf.some(
      (variant) => typeof variant === 'object' && 'type' in variant && variant.type === type,
    );
  const coveredPrimitives = ['boolean', 'string', 'number', 'integer', 'null'];
  for (const type of types) {
    if (coveredPrimitives.includes(type) && covered(type)) continue;
    uniqueTypes.push(
      type === 'null'
        ? NULL
        : schemaType({ ...schema, type, oneOf: undefined } as SchemaObject, ctx, path),
    );
  }
  return unionType(uniqueTypes);
}

/** Object members: properties, index signatures, and inherited discriminators. */
function objectMembers(schema: SchemaObject, ctx: Context, path: string): ts.TypeNode | undefined {
  const members: ts.TypeElement[] = [];

  for (const key of ['allOf', 'anyOf'] as const) {
    if (!schema[key]) continue;
    const discriminator =
      !schema.discriminator &&
      !ctx.discriminators.refsHandled.includes(path) &&
      ctx.discriminators.objects[path];
    if (discriminator) {
      members.unshift(discriminatorProperty(discriminator, path, ctx.immutable));
      break;
    }
  }

  const properties = 'properties' in schema && schema.properties ? schema.properties : undefined;
  const additional = 'additionalProperties' in schema ? schema.additionalProperties : undefined;
  const patterns =
    'patternProperties' in schema && schema.patternProperties
      ? schema.patternProperties
      : undefined;
  if (!((properties && Object.keys(properties).length) || additional || patterns || schema.$defs)) {
    return members.length ? ts.factory.createTypeLiteralNode(members) : undefined;
  }

  if (Object.keys(properties ?? {}).length) {
    for (const [key, value] of getEntries(properties, ctx)) {
      if ((typeof value !== 'object' && typeof value !== 'boolean') || Array.isArray(value)) {
        throw new Error(
          `${path}: invalid property ${key}. Expected Schema Object or boolean, got ${
            Array.isArray(value) ? 'Array' : typeof value
          }`,
        );
      }
      const readOnly = typeof value === 'object' && 'readOnly' in value && value.readOnly;
      const optional = schema.required?.includes(key) ? undefined : QUESTION_TOKEN;
      const type = schemaType(value, ctx, createRef([path, key]));
      const property = ts.factory.createPropertySignature(
        modifiers({ readonly: ctx.immutable || Boolean(readOnly) }),
        propertyIndex(key),
        optional,
        type,
      );
      jsdocComment(value, property);
      members.push(property);
    }
  }

  const indexTypes: ts.TypeNode[] = [];
  if (typeof additional === 'object' && Object.keys(additional).length) {
    indexTypes.push(schemaType(additional as SchemaObject, ctx, path));
  }
  if (additional === true || (typeof additional === 'object' && !Object.keys(additional).length)) {
    indexTypes.push(UNKNOWN);
  }
  for (const pattern of Object.values(patterns ?? {})) {
    indexTypes.push(schemaType(pattern, ctx, path));
  }

  if (!indexTypes.length) {
    return members.length ? ts.factory.createTypeLiteralNode(members) : undefined;
  }
  return intersectionType([
    ...(members.length ? [ts.factory.createTypeLiteralNode(members)] : []),
    ts.factory.createTypeLiteralNode([
      ts.factory.createIndexSignature(
        modifiers({ readonly: ctx.immutable }),
        [
          ts.factory.createParameterDeclaration(
            /* modifiers */ undefined,
            /* dotDotDotToken */ undefined,
            'key',
            /* questionToken */ undefined,
            STRING,
          ),
        ],
        unionType(indexTypes),
      ),
    ]),
  ]);
}
