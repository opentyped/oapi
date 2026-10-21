export class GenerationError extends Error {
  override name = 'GenerationError';
  files: string[] = [];
  watchRoots: string[] = [];

  withSources(files: Iterable<string>, roots: Iterable<string>): this {
    this.files = [...new Set([...this.files, ...files])].sort();
    this.watchRoots = [...new Set([...this.watchRoots, ...roots])].sort();
    return this;
  }
}

/** A source location remains useful after the AST is no longer needed. */
export interface Source {
  location: string;
  fail(message: string): never;
}
