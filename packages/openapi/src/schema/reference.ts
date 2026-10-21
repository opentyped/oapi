import { escapePointer, parsePointer } from '~/pointer';
import type { Schema } from '~/schema/definition';
import { GenerationError } from '~/diagnostic';

export const COMPONENTS = '#/components/schemas/';

/** Component name followed by schema-position tokens, decoded from a URI fragment. */
export function componentPath(ref: string): string[] | undefined {
  if (!ref.startsWith('#')) return;
  const fragment = decodeURIComponent(ref.slice(1));
  if (!fragment.startsWith(COMPONENTS.slice(1))) return;
  let path: string[];
  try {
    path = parsePointer(fragment);
  } catch {
    throw new GenerationError(`Invalid JSON pointer ${ref}.`);
  }
  return path.length >= 3 && path[0] === 'components' && path[1] === 'schemas'
    ? path.slice(2)
    : undefined;
}

/** Component keys have a narrower alphabet than JSON Schema definition keys. */
export function componentName(name: string): string {
  if (/^[a-zA-Z0-9._-]+$/.test(name)) return name;
  const readable = name
    .replace(
      /"([a-zA-Z0-9._/+-]+)"/g,
      (_match, value: string) => `Literal_${value.replace(/[/+]/g, '_')}`,
    )
    .replace(/\bkeyof\s+/g, 'KeysOf')
    .replace(/\[([^[\]]+)\]/g, 'TupleOf$1')
    .replace(/\?/g, 'Optional')
    .replace(/<\s*/g, 'Of')
    .replace(/\s*,\s*/g, 'And')
    .replace(/>/g, '')
    .replace(/\[\]/g, 'Array')
    .replace(/\s*\|\s*/g, '.Or.')
    .replace(/\s*&\s*/g, '.And.');
  if (/^[a-zA-Z0-9._-]+$/.test(readable)) return readable;
  throw new GenerationError(
    `Cannot name schema '${name}'. Introduce a named type alias or provide @schemaName with a readable component name.`,
  );
}

export function pointer(name: string): string {
  return encodeURIComponent(escapePointer(name));
}

/** Reference annotations participate in graph operations without traversing arbitrary JSON data. */
export function mapReferences(
  schema: Schema,
  rewrite: (ref: string, kind: '$ref' | '$dynamicRef' | 'mapping') => string,
): Schema {
  const result = { ...schema };
  for (const field of ['$ref', '$dynamicRef'] as const) {
    const ref = result[field];
    if (typeof ref === 'string') result[field] = rewrite(ref, field);
  }
  const discriminator = schema.discriminator;
  if (discriminator !== undefined) {
    if (
      !discriminator ||
      typeof discriminator !== 'object' ||
      Array.isArray(discriminator) ||
      typeof discriminator.propertyName !== 'string' ||
      !discriminator.propertyName.trim()
    )
      throw new GenerationError('Schema discriminator requires a nonempty propertyName.');
    const mapping = discriminator.mapping;
    if (mapping !== undefined) {
      if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping))
        throw new GenerationError('Discriminator mapping must be an object.');
      result.discriminator = {
        ...discriminator,
        mapping: Object.fromEntries(
          Object.entries(mapping).map(([name, ref]) => {
            if (typeof ref !== 'string')
              throw new GenerationError('Discriminator mapping references must be strings.');
            return [name, rewrite(ref, 'mapping')];
          }),
        ),
      };
    }
  }
  return result;
}
