import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { InfoObject } from 'openapi3-ts/oas32';
import { GenerationError } from '@opentyped/openapi/diagnostic';

function packageContact(author: unknown): InfoObject['contact'] {
  const person =
    typeof author === 'string'
      ? {
          name: author.match(/^[^<(]+/)?.[0].trim(),
          email: author.match(/<([^>]+)>/)?.[1]?.trim(),
          url: author.match(/\(([^)]+)\)/)?.[1]?.trim(),
        }
      : author;
  if (!person || typeof person !== 'object' || Array.isArray(person)) return undefined;
  const fields = Object.entries(person).filter(
    ([key, value]) =>
      ['name', 'email', 'url'].includes(key) && typeof value === 'string' && value.length > 0,
  );
  return fields.length ? Object.fromEntries(fields) : undefined;
}

/** Infer document metadata without importing or executing the application's package. */
export function packageInfo(
  root: string,
  overrides: Partial<InfoObject> | undefined,
  files: Set<string>,
): InfoObject {
  if (overrides?.title !== undefined && overrides.version !== undefined)
    return overrides as InfoObject;
  let directory = root;
  while (true) {
    const file = path.join(directory, 'package.json');
    files.add(file);
    let text: string | undefined;
    try {
      text = readFileSync(file, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        throw new GenerationError(`Cannot read API package metadata ${file}: ${String(error)}`);
    }
    if (text !== undefined) {
      let manifest: Record<string, unknown>;
      try {
        const value: unknown = JSON.parse(text.replace(/^\uFEFF/, ''));
        if (!value || typeof value !== 'object' || Array.isArray(value))
          throw new Error('Expected a package object.');
        manifest = value as Record<string, unknown>;
      } catch (error) {
        throw new GenerationError(`Invalid API package metadata ${file}: ${String(error)}`);
      }
      const contact = packageContact(manifest.author);
      return {
        ...(typeof manifest.description === 'string' ? { description: manifest.description } : {}),
        ...(typeof manifest.license === 'string' && manifest.license !== 'UNLICENSED'
          ? { license: { name: manifest.license } }
          : {}),
        ...(contact ? { contact } : {}),
        title: manifest.name as string,
        version: manifest.version as string,
        ...Object.fromEntries(
          Object.entries(overrides ?? {}).filter(([, value]) => value !== undefined),
        ),
      };
    }
    const parent = path.dirname(directory);
    if (parent === directory)
      throw new GenerationError('info.title and info.version are required without a package.json.');
    directory = parent;
  }
}
