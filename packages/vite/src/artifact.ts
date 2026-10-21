import { DeclarationFile } from '~/declaration';
import { mkdir, readFile, realpath, rename, lstat } from 'node:fs/promises';
import path from 'node:path';
import type { Generation, OutputOptions } from '@typedapi/compiler/config';
import { stableJson } from '@typedapi/openapi/json';
import { removeFile, replaceFile } from '~/file';

/** Tracks generated files without claiming unrelated files in the output directory. */
export class ArtifactManifest {
  private constructor(
    private readonly directory: string,
    private readonly files: readonly string[],
  ) {}

  static async read(directory: string): Promise<ArtifactManifest> {
    let files: string[] = [];
    try {
      const value: unknown = JSON.parse(
        await readFile(path.join(directory, '.typedapi.json'), 'utf8'),
      );
      if (Array.isArray(value))
        files = value.filter((name): name is string => typeof name === 'string');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    return new ArtifactManifest(directory, files);
  }

  async commit(outputs: Iterable<string>): Promise<void> {
    const current = new Set(outputs);
    const folded = new Map([...current].map((name) => [name.toLowerCase(), name]));
    for (const name of this.files) {
      if (!/^schemas\/[a-zA-Z0-9._-]+\.json$/.test(name) || current.has(name)) continue;
      const file = path.join(this.directory, name);
      const replacement = folded.get(name.toLowerCase());
      if (replacement !== undefined) {
        const retained = path.join(this.directory, replacement);
        try {
          const [previous, next, oldEntry, newEntry] = await Promise.all([
            realpath(file),
            realpath(retained),
            lstat(file, { bigint: true }),
            lstat(retained, { bigint: true }),
          ]);
          if (previous === next && oldEntry.dev === newEntry.dev && oldEntry.ino === newEntry.ino) {
            // Preserve the new output and its requested casing on case-insensitive volumes.
            await rename(file, retained);
            continue;
          }
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
      }
      await removeFile(file);
    }
    await replaceFile(path.join(this.directory, '.typedapi.json'), stableJson([...current]));
  }
}

/** Generation finishes before writes begin. Only files in the ownership manifest can be removed. */
export async function writeArtifacts(
  options: OutputOptions,
  result: Generation,
): Promise<Generation> {
  new DeclarationFile(options).write(result);
  const directory = path.resolve(options.root ?? process.cwd(), options.outDir ?? '.openapi');
  const manifest = await ArtifactManifest.read(directory);
  const outputs = new Map<string, string>([
    ['openapi.json', stableJson(result.document)],
    ...Object.entries(result.schemas).map(([name, schema]): [string, string] => [
      `schemas/${name}.json`,
      stableJson(schema),
    ]),
  ]);
  await mkdir(path.join(directory, 'schemas'), { recursive: true });
  for (const [name, content] of outputs) await replaceFile(path.join(directory, name), content);
  await manifest.commit(outputs.keys());
  return result;
}
