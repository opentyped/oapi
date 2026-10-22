import path from 'node:path';
import { TypeMappings } from '@opentyped/oapi-schema';
import { GenerationError } from '@opentyped/oapi-openapi/diagnostic';
import { TypeSafety } from '~/parser/schema/safety';
import { compileSchemas } from '~/parser/schema/compiler';
import type { Parser } from '~/parser/parser';
import type { ParserContext } from '~/parser/context';

export class SchemaSafety implements Parser {
  readonly name = 'schema/safety';
  readonly stage = 'validate';
  parse(context: ParserContext): void {
    const options = context.project.program.getCompilerOptions();
    if (!(options.strictNullChecks ?? options.strict))
      throw new GenerationError(
        'strictNullChecks (or strict) must be enabled; otherwise nullability is erased by TypeScript.',
      );
    const mappings = new TypeMappings(
      context.project.program,
      context.options.typeMappings,
      path.dirname(context.project.configPath),
    );
    const safety = new TypeSafety(context.project.checker, context.options.types, (type) =>
      mappings.has(type),
    );
    for (const declaration of context.declarations) {
      safety.check(
        context.project.checker.getTypeAtLocation(declaration.node),
        declaration.node,
        declaration.name,
      );
      if (declaration.output)
        safety.check(
          context.project.checker.getTypeAtLocation(declaration.output),
          declaration.output,
          `${declaration.name} output`,
        );
    }
    context.warnings.push(...safety.warnings);
  }
}
export class SchemaCompiler implements Parser {
  readonly name = 'schema/compiler';
  readonly stage = 'schema';

  parse(context: ParserContext): void {
    context.compilation = compileSchemas(
      context.project,
      context.declarations,
      context.identities,
      context.options.$self,
      context.options.types,
      context.options.typeMappings,
    );
  }
}
