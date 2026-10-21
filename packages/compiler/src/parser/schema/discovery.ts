import { visitAnnotations } from '~/parser/annotation';
import { modelDeclaration } from '~/parser/declaration';
import type { Parser } from '~/parser/parser';
import type { ParserContext } from '~/parser/context';

export class SchemaDiscovery implements Parser {
  readonly name = 'schema/annotations';
  readonly stage = 'discover';
  parse(context: ParserContext): void {
    visitAnnotations(context.project, (node, annotations) => {
      if (
        !annotations.has('schema') ||
        annotations.has('route') ||
        annotations.has('webhook') ||
        annotations.has('response')
      )
        return;
      context.declarations.push(
        modelDeclaration(node, annotations, { emitOperation: false, emitResponse: false }),
      );
      return false;
    });
  }
}
