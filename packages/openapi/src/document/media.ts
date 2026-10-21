import { parse, format } from 'content-type';
import type { Source } from '~/diagnostic';

/** content-type 1.x intentionally supplies strict parsing; its 2.x parser is lenient. */
export function mediaIdentity(value: string, source: Source): string {
  try {
    const parsed = parse(value);
    const [type, subtype] = parsed.type.split('/');
    if (
      (type!.includes('*') && (type !== '*' || subtype !== '*')) ||
      (subtype!.includes('*') && subtype !== '*')
    )
      return source.fail('Invalid media type wildcard.');
    if (parsed.parameters.charset)
      parsed.parameters.charset = parsed.parameters.charset.toLowerCase();
    return format(parsed);
  } catch (error) {
    return source.fail(
      `Invalid media type: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function mediaType(value: string, source: Source): string {
  mediaIdentity(value, source);
  return value;
}

export function mediaBase(value: string, source: Source): string {
  return parse(mediaIdentity(value, source)).type;
}
