import { DEFAULT_OPENAPI } from '@opentyped/openapi/document/definition';
import { sourceOf } from '@opentyped/ast/diagnostic';
import type { Source } from '@opentyped/openapi/diagnostic';
import type { SourceTransform } from '~/parser/transform';
import type ts from 'typescript';
import type { Project } from '@opentyped/ast/project';
import { walkProject } from '@opentyped/ast/walk';
import type { ParserOptions } from '~/parser/options';
import type { ModelDeclaration } from '~/parser/declaration';
import type { Compilation } from '@opentyped/openapi/schema/compilation';
import type { ModelIdentity } from '~/parser/declaration';
import type { OpenApiDocument } from '@opentyped/openapi/document/definition';
import type { Schema } from '@opentyped/openapi/schema/definition';
import { DIALECT } from '@opentyped/openapi/schema/dialect';

/** One project's mutable generation state, shared by its configured parser steps. */
export class ParserContext {
  declarations: ModelDeclaration[] = [];
  compilation: Compilation | undefined;
  readonly warnings: string[] = [];
  readonly schemas: Record<string, Schema> = Object.create(null) as Record<string, Schema>;
  readonly document: OpenApiDocument;
  readonly transforms: SourceTransform[] = [];

  constructor(
    readonly project: Project,
    readonly options: ParserOptions,
    readonly identities: ModelIdentity,
    readonly hasDocuments = false,
  ) {
    const version = options.openapi ?? DEFAULT_OPENAPI;
    this.options = { ...options, openapi: version };
    this.document = {
      openapi: version,
      ...(options.$self !== undefined ? { $self: options.$self } : {}),
      jsonSchemaDialect: DIALECT,
      info: structuredClone(options.info),
      paths: {},
      components: { schemas: {} },
    };
  }

  source(node: ts.Node): Source {
    return sourceOf(node);
  }

  visit(visitor: (node: ts.Node) => boolean | void): void {
    walkProject(this.project, visitor);
  }
}
