import remapping from '@jridgewell/remapping';
import { GenerationError } from '@typedapi/openapi/diagnostic';
import type { SourceTransform } from '@typedapi/compiler/parser/parser';

/** Runs framework transforms in order and traces their maps to checked source. */
export class SourceTransforms {
  constructor(private readonly steps: readonly SourceTransform[]) {}

  apply(code: string, file: string): ReturnType<SourceTransform['apply']> {
    let current = code;
    let map: string | undefined;
    for (const step of this.steps) {
      const checked = step.source(file);
      if (checked !== undefined && checked !== code && step.apply(checked, file))
        throw new GenerationError(
          `${file}: Registered endpoint source differs from checked TypeScript. Keep route metadata in source; run TypedAPI before preprocessing that preserves endpoint semantics.`,
        );
      const value = step.apply(current, file);
      if (!value) {
        if (current !== code) {
          const original = step.apply(code, file);
          if (original && (original.code !== current || original.map !== map))
            throw new GenerationError(
              `${file}: Source transforms conflict: a later transform requires the original checked input after an earlier transform changed it.`,
            );
        }
        continue;
      }
      const { code: next, map: nextMap } = value;
      if (typeof next !== 'string' || typeof nextMap !== 'string')
        throw new GenerationError(
          `${file}: Source transforms must synchronously return code and source-map strings.`,
        );
      map = this.compose(nextMap, map, file);
      current = next;
    }
    return map === undefined ? undefined : { code: current, map };
  }

  private compose(latest: string, previous: string | undefined, file: string): string {
    try {
      const input = JSON.parse(latest) as { sources?: unknown; mappings?: unknown };
      if (Array.isArray(input.sources) && input.sources.length > 1)
        throw new Error('Vite source transforms require a single input source per map.');
      if (!Object.hasOwn(input, 'version') && input.mappings === '')
        return JSON.stringify({ version: 3, sources: [], names: [], mappings: '' });
      if (previous === undefined) return latest;
      return remapping([latest, previous], () => null).toString();
    } catch (error) {
      throw new GenerationError(
        `${file}: Cannot compose source maps: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
