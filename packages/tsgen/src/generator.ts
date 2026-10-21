import ts from 'typescript';
import { DocumentValidation } from '@typedapi/openapi';
import type { OpenApiDocument } from '@typedapi/openapi';
import { validateJson } from '@typedapi/openapi/json';
import { createContext } from '~/context';
import { resolveSchemaReferences } from '~/pointer';
import { documentNodes } from '~/transform/document';
import { schemaType } from '~/transform/schema';
import type { Context } from '~/context';
import type { Document, SchemaObject } from '~/types';

export interface DefinitionOptions {
  /** Emit readonly properties and readonly arrays. */
  immutable?: boolean;
  /** Alphabetize object members. */
  alphabetize?: boolean;
}

/**
 * Generate namespace-safe TypeScript definitions from an OpenAPI 3.1/3.2
 * document. The document is validated and cloned before generation; the
 * caller's value is never mutated.
 */
export function definitionNodes(document: object, options: DefinitionOptions = {}): ts.Node[] {
  validateJson(document, 'OpenAPI document');
  const schema = structuredClone(document) as Document;
  if (schema.paths === undefined) schema.paths = {};
  if (schema.components === undefined) schema.components = { schemas: {} };
  else if (
    schema.components &&
    typeof schema.components === 'object' &&
    !Array.isArray(schema.components) &&
    schema.components.schemas === undefined
  ) {
    schema.components.schemas = {};
  }
  new DocumentValidation().validate(schema as unknown as OpenApiDocument);
  if (!['3.1.0', '3.2.0'].includes(schema.openapi)) {
    throw new Error('Definition generation requires OpenAPI 3.1 or 3.2.');
  }
  return generate(schema, options);
}

function generate(document: Document, options: DefinitionOptions): ts.Node[] {
  const definitions = resolveSchemaReferences(document, document.$self);
  const ctx: Context = createContext(document, options);
  // Every extracted definition gets a stable, collision-proof alias.
  for (const path of definitions.keys()) {
    ctx.schemaAliases.set(
      path,
      `$Definition_${Buffer.from(decodeURIComponent(path)).toString('hex')}`,
    );
  }
  for (const [path, definition] of definitions) {
    ctx.injectFooter.push(
      ts.factory.createTypeAliasDeclaration(
        /* modifiers */ undefined,
        ctx.schemaAliases.get(path)!,
        /* typeParameters */ undefined,
        schemaType(definition as SchemaObject, ctx, path),
      ),
    );
  }
  return documentNodes(document, ctx);
}
