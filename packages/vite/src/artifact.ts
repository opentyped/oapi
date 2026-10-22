import path from 'node:path';
import type { Generation, OutputOptions } from '@opentyped/compiler/config';
import { stableJson } from '@opentyped/openapi/json';
import { DeclarationFile } from '~/declaration';
import { replaceFile } from '~/file';

/** Publish only the two configured files, after generation and validation succeed. */
export function writeArtifacts(options: OutputOptions, result: Generation): Generation {
  const declaration = new DeclarationFile(options);
  const definitions = declaration.render(result);
  const document = stableJson(result.document);
  replaceFile(path.resolve(options.root ?? process.cwd(), options.output.document), document);
  replaceFile(declaration.file, definitions);
  return result;
}
