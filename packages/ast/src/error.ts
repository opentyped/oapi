/** TypeScript analysis failures retain project dependencies for build integrations. */
export class AnalysisError extends Error {
  override name = 'AnalysisError';
  files: string[] = [];
  watchRoots: string[] = [];

  withSources(files: Iterable<string>, roots: Iterable<string>): this {
    this.files = [...new Set([...this.files, ...files])].sort();
    this.watchRoots = [...new Set([...this.watchRoots, ...roots])].sort();
    return this;
  }
}

export interface Source {
  location: string;
  fail(message: string): never;
}
