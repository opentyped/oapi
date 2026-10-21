import path from 'node:path';
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { generateDeclarations } from '@typedapi/tsgen';
import type { Generation, OutputOptions } from '@typedapi/compiler/config';

/** Atomically replaces the ambient declarations; unchanged output does not trigger rebuilds. */
export class DeclarationFile {
  readonly directory: string;
  readonly file: string;

  constructor(private readonly options: Pick<OutputOptions, 'root' | 'declarations'>) {
    this.directory = path.resolve(
      options.root ?? process.cwd(),
      options.declarations?.outDir ?? '.openapi',
    );
    this.file = path.join(this.directory, 'openapi.d.ts');
  }

  write(result: Generation): void {
    const content = generateDeclarations(result.document, {
      models: result.models,
      ...(this.options.declarations?.prefix === undefined
        ? {}
        : { prefix: this.options.declarations.prefix }),
    });
    try {
      if (readFileSync(this.file, 'utf8') === content) return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    mkdirSync(this.directory, { recursive: true });
    const staging = mkdtempSync(path.join(this.directory, '.typedapi-'));
    try {
      const file = path.join(staging, 'openapi.d.ts');
      writeFileSync(file, content);
      renameSync(file, this.file);
    } finally {
      rmSync(staging, { recursive: true, force: true });
    }
  }
}
