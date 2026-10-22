import path from 'node:path';
import { generateDeclarations } from '@opentyped/oapi-tsgen';
import type { Generation, OutputOptions } from '@opentyped/oapi-compiler/config';

/** Renders ambient declarations at the configured output path. */
export class DeclarationFile {
  readonly file: string;

  constructor(private readonly options: Pick<OutputOptions, 'root' | 'output' | 'prefix'>) {
    const root = options.root ?? process.cwd();
    this.file = path.resolve(root, options.output.declarations);
    if (this.file === path.resolve(root, options.output.document))
      throw new Error('Document and declaration outputs must be different files.');
  }

  render(result: Generation): string {
    return generateDeclarations(result.document, {
      models: result.models,
      ...(this.options.prefix === undefined ? {} : { prefix: this.options.prefix }),
    });
  }
}
