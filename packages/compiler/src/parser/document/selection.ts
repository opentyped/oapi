import path from 'node:path';
import type { ModelDeclaration } from '~/parser/declaration';
import { GenerationError } from '@opentyped/oapi-openapi/diagnostic';

import type { Selection } from '@opentyped/oapi-openapi/registration';

/** Owns explicit document membership, the counterpart to Utoipa's OpenApi registration. */
export class DeclarationSelection {
  constructor(
    private readonly declarations: ModelDeclaration[],
    private readonly configPath: string,
  ) {}

  private resolve(
    name: string,
    kind: 'paths' | 'webhooks' | 'schemas' | 'responses',
  ): ModelDeclaration {
    const matches = this.declarations.filter((declaration) => {
      const file = path
        .relative(path.dirname(this.configPath), declaration.node.getSourceFile().fileName)
        .split(path.sep)
        .join('/');
      return declaration.name === name || `${file}#${declaration.name}` === name;
    });
    if (!matches.length) throw new GenerationError(`Unknown ${kind} registration ${name}.`);
    if (matches.length > 1)
      throw new GenerationError(
        `Ambiguous ${kind} registration ${name}. Use source-relative file.ts#Name identifiers.`,
      );
    const declaration = matches[0]!;
    if (
      kind === 'paths'
        ? !declaration.emitOperation || declaration.annotations.has('webhook')
        : kind === 'webhooks'
          ? !declaration.emitOperation || !declaration.annotations.has('webhook')
          : kind === 'responses'
            ? !declaration.emitResponse
            : !declaration.emitSchema
    ) {
      declaration.source.fail(
        `${name} is not marked with ${kind === 'paths' ? '@route' : kind === 'webhooks' ? '@webhook' : kind === 'responses' ? '@response' : '@schema'}.`,
      );
    }
    return declaration;
  }

  select(selection: Selection | undefined): ModelDeclaration[] {
    if (!selection) return this.declarations;
    const paths = new Set((selection.paths ?? []).map((name) => this.resolve(name, 'paths')));
    const webhooks = new Set(
      (selection.webhooks ?? []).map((name) => this.resolve(name, 'webhooks')),
    );
    const schemas = new Set((selection.schemas ?? []).map((name) => this.resolve(name, 'schemas')));
    const responses = new Set(
      (selection.responses ?? []).map((name) => this.resolve(name, 'responses')),
    );
    return this.declarations
      .filter(
        (declaration) =>
          paths.has(declaration) ||
          webhooks.has(declaration) ||
          schemas.has(declaration) ||
          responses.has(declaration),
      )
      .map((declaration) => ({
        ...declaration,
        emitOperation: paths.has(declaration) || webhooks.has(declaration),
        emitSchema: schemas.has(declaration),
        emitResponse: responses.has(declaration),
      }));
  }
}
