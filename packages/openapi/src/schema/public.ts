import type { Schema } from '~/schema/definition';
import { mapSchema } from '~/schema/visitor';

/** Compiler-only HTTP annotations are not JSON Schema keywords or user-visible extensions. */
export function publicSchema(schema: Schema): Schema {
  return mapSchema(schema, (item) => {
    const result = { ...item };
    delete result.http;
    return result;
  });
}
