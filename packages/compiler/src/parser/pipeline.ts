import { stages } from '~/parser/parser';
import type { Parser } from '~/parser/parser';
import type { ParserContext } from '~/parser/context';
import { GenerationError } from '@opentyped/openapi/diagnostic';

/** Orders rules by stage and owns rule validation and error attribution. */
export class ParserPipeline {
  private readonly parsers: Parser[];
  constructor(parsers: readonly Parser[]) {
    if (!Array.isArray(parsers)) throw new GenerationError('parsers must be an array.');
    const names = new Set<string>();
    for (const parser of parsers) {
      if (
        !parser ||
        typeof parser.name !== 'string' ||
        !parser.name.trim() ||
        typeof parser.parse !== 'function' ||
        !stages.includes(parser.stage)
      )
        throw new GenerationError(
          'Each parser requires a name, supported stage and parse(context) function.',
        );
      if (names.has(parser.name))
        throw new GenerationError(`Duplicate parser name ${parser.name}.`);
      names.add(parser.name);
    }
    this.parsers = stages.flatMap((stage) => parsers.filter((parser) => parser.stage === stage));
  }

  run(context: ParserContext): void {
    for (const parser of this.parsers) {
      try {
        const value: unknown = parser.parse(context);
        if (
          value &&
          (typeof value === 'object' || typeof value === 'function') &&
          'then' in value &&
          typeof value.then === 'function'
        ) {
          void Promise.resolve(value).catch(() => {});
          throw new GenerationError('Parsers must be synchronous.');
        }
      } catch (error) {
        const failure = new GenerationError(
          `Parser ${parser.name}: ${error instanceof Error ? error.message : String(error)}`,
        );
        if (error instanceof GenerationError) failure.withSources(error.files, error.watchRoots);
        throw failure;
      }
    }
  }
}
