/** A parser may register a checked source transform for its own framework. */
export interface SourceTransform {
  source(file: string): string | undefined;
  /** Consume the preceding step's output and map it back to that input. */
  apply(code: string, file: string): { code: string; map: string } | undefined;
}
