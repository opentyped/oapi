import { DocumentRegistration } from '~/parser/document/registration';
import { GenerationError } from '@opentyped/openapi/diagnostic';
import type { Parser } from '~/parser/parser';
import type { ParserContext } from '~/parser/context';

export class DocumentParser implements Parser {
  readonly name = 'document/registration';
  readonly stage = 'register';
  parse(context: ParserContext): void {
    const declarations = context.declarations.sort(
      (a, b) =>
        a.node.getSourceFile().fileName.localeCompare(b.node.getSourceFile().fileName) ||
        a.node.pos - b.node.pos,
    );
    const supplied =
      Object.keys(context.document.paths).length > 0 ||
      Object.keys(context.document.webhooks ?? {}).length > 0 ||
      Object.values(context.document.components).some(
        (section) => Object.keys(section ?? {}).length > 0,
      );
    if (!declarations.length && !context.hasDocuments && !supplied)
      throw new GenerationError(
        `No @schema or @route or @response or @webhook declarations found in ${context.project.configPath}.`,
      );
    context.declarations = new DocumentRegistration(
      declarations,
      context.project.configPath,
    ).select(context.options.include, context.options.nest);
  }
}
