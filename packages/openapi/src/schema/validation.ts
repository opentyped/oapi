import { SchemaResource } from '~/schema/resource';
import type { SchemaMode } from '~/schema/resource';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { validate } from '@scalar/openapi-validator';
import type { Source } from '~/diagnostic';
import type { Schema, Components } from '~/schema/definition';
import { standalone } from '~/schema/graph';

const validator = new Ajv2020({ strict: false, allErrors: true, validateFormats: false });

/** Validate explicitly supplied JSON Schemas using the dialect's meta-schema and reference graph. */
export function explicitSchema(
  value: unknown,
  components: Components,
  source: Source,
  mode: SchemaMode = 'embedded',
): Schema {
  if (typeof value === 'boolean') return value ? {} : { not: {} };
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return source.fail('Schema must be a JSON Schema object or boolean.');
  try {
    if (!validator.validateSchema(value)) throw new Error(validator.errorsText());
    const schema = value as Schema;
    if (mode !== 'document') {
      new SchemaResource(schema, mode).validate();
      standalone(schema, components);
    }
    return schema;
  } catch (error) {
    return source.fail(
      `Invalid JSON Schema: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** Scalar's XML Object schema validates annotations without interpreting JSON Schema data. */
export function xmlAnnotations(values: readonly unknown[], source: Source): void {
  if (!values.length) return;
  // Scalar's 3.1 schema leaves annotations open; its 3.0 XML Object has the same shape.
  const result = validate({
    openapi: '3.0.3',
    info: { title: 'XML annotations', version: '1' },
    paths: {},
    components: {
      schemas: Object.fromEntries(values.map((xml, index) => [`annotation${index}`, { xml }])),
    },
  });
  if (!result.valid)
    source.fail(
      `Invalid XML annotations: ${result.errors.map((error) => error.message).join('; ')}`,
    );
}
