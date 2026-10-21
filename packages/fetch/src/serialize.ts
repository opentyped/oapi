export interface QuerySerializerOptions {
  array?: { style: 'form' | 'spaceDelimited' | 'pipeDelimited'; explode?: boolean };
  object?: { style: 'form' | 'deepObject'; explode?: boolean };
}
export type QuerySerializer = (query: Record<string, unknown>) => string;
export type PathSerializer = (path: string, params: Record<string, unknown>) => string;

function scalar(value: unknown): string {
  if (
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  )
    return String(value);
  throw new TypeError('HTTP parameters require strings, booleans or finite numbers.');
}

/** Default simple path serialization; reject missing values instead of sending template braces. */
export function pathParameters(path: string, params: Record<string, unknown>): string {
  return path.replace(/\{([^{}]+)\}/g, (_match, name: string) => {
    if (!Object.prototype.hasOwnProperty.call(params, name) || params[name] == null)
      throw new TypeError(`Missing path parameter ${name}.`);
    const value = params[name];
    if (Array.isArray(value))
      return value.map((item: unknown) => encodeURIComponent(scalar(item))).join(',');
    if (value && typeof value === 'object')
      return Object.entries(value)
        .flatMap(([key, item]) => [encodeURIComponent(key), encodeURIComponent(scalar(item))])
        .join(',');
    return encodeURIComponent(scalar(value));
  });
}

/** OpenAPI form, deepObject and delimited query values; custom serializers cover other policies. */
export function queryParameters(
  query: Record<string, unknown>,
  options: QuerySerializerOptions = {},
): string {
  const pairs: string[] = [];
  const encode = (value: unknown): string => encodeURIComponent(scalar(value));
  for (const [name, value] of Object.entries(query)) {
    if (value == null) continue;
    const key = encodeURIComponent(name);
    if (Array.isArray(value)) {
      const style = options.array?.style ?? 'form';
      const explode = options.array?.explode ?? style === 'form';
      const delimiter = { form: ',', spaceDelimited: '%20', pipeDelimited: '|' }[style];
      if (explode) for (const item of value) pairs.push(`${key}=${encode(item)}`);
      else pairs.push(`${key}=${value.map(encode).join(delimiter)}`);
    } else if (typeof value === 'object') {
      const entries = Object.entries(value);
      const style = options.object?.style ?? 'deepObject';
      if (style === 'deepObject')
        for (const [field, item] of entries)
          pairs.push(`${key}[${encodeURIComponent(field)}]=${encode(item)}`);
      else if (options.object?.explode ?? true)
        for (const [field, item] of entries)
          pairs.push(`${encodeURIComponent(field)}=${encode(item)}`);
      else
        pairs.push(
          `${key}=${entries.flatMap(([field, item]) => [encodeURIComponent(field), encode(item)]).join(',')}`,
        );
    } else pairs.push(`${key}=${encode(value)}`);
  }
  return pairs.join('&');
}

export function headerParameter(value: unknown): string {
  if (Array.isArray(value)) return value.map(scalar).join(',');
  if (value && typeof value === 'object')
    return Object.entries(value)
      .flatMap(([key, item]) => [key, scalar(item)])
      .join(',');
  return scalar(value);
}

export type NativeHeaders = NonNullable<RequestInit['headers']>;
export type RequestHeaders = NativeHeaders | Record<string, unknown>;

export function requestHeaders(
  defaults: NativeHeaders | undefined,
  extra: RequestHeaders | undefined,
  cookies: Record<string, unknown>,
): Headers {
  const headers = new Headers(defaults);
  if (extra instanceof Headers || Array.isArray(extra)) {
    new Headers(extra as NativeHeaders).forEach((value, name) => headers.set(name, value));
  } else {
    for (const [name, value] of Object.entries(extra ?? {})) {
      if (value != null) headers.set(name, headerParameter(value));
    }
  }
  const values: string[] = [];
  for (const [name, value] of Object.entries(cookies)) {
    if (value == null) continue;
    values.push(encodeURIComponent(name) + '=' + encodeURIComponent(headerParameter(value)));
  }
  if (values.length) {
    const existing = headers.get('cookie');
    if (existing) values.unshift(existing);
    headers.set('cookie', values.join('; '));
  }
  return headers;
}
