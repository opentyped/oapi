import { visitAnnotations } from '~/parser/annotation';
import { markedDeclaration } from '~/parser/endpoint/declaration';
import type { Parser } from '~/parser/parser';
import type { ParserContext } from '~/parser/context';

/** Optional declaration discovery for @route, @webhook and reusable @response JSDoc tags. */
export class JSDocEndpointParser implements Parser {
  readonly name = 'endpoint/jsdoc';
  readonly stage = 'discover';
  parse(context: ParserContext): void {
    visitAnnotations(context.project, (node, annotations) => {
      if (!annotations.has('route') && !annotations.has('webhook') && !annotations.has('response'))
        return;
      context.declarations.push(markedDeclaration(node, annotations, context.project.checker));
      return false;
    });
  }
}
