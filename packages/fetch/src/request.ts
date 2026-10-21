import { encodeBody } from '~/body';
import type { BodyFor } from '~/body';
import { pathParameters, queryParameters, requestHeaders } from '~/serialize';
import type { MediaContent, ParameterOf, RequestBodyOf, RequiredKeys } from '~/operation';
import type {
  NativeHeaders,
  PathSerializer,
  QuerySerializer,
  QuerySerializerOptions,
} from '~/serialize';

/** Only the string-URL Fetch call is required; native and injected implementations both fit. */
export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface ClientOptions extends Omit<RequestInit, 'method' | 'body'> {
  baseUrl?: string;
  fetch?: Fetch;
  querySerializer?: QuerySerializer | QuerySerializerOptions;
  pathSerializer?: PathSerializer;
}

type ParameterOption<Name extends string, Values> = [Values] extends [never]
  ? { [Key in Name]?: never }
  : [RequiredKeys<Values>] extends [never]
    ? { [Key in Name]?: Values }
    : { [Key in Name]: Values };

type HeaderValues<Operation> = ParameterOf<Operation, 'header'>;
type HeaderOptions<Operation> = [HeaderValues<Operation>] extends [never]
  ? { headers?: NativeHeaders }
  : [RequiredKeys<HeaderValues<Operation>>] extends [never]
    ? {
        headers?:
          Headers | [string, string][] | (HeaderValues<Operation> & Record<string, unknown>);
      }
    : { headers: HeaderValues<Operation> & Record<string, unknown> };

type NoPayload = { body?: never };
type PayloadOptions<Operation> = [RequestBodyOf<Operation>] extends [never]
  ? NoPayload
  : | BodyFor<MediaContent<RequestBodyOf<Operation>>>
    | (Operation extends { requestBody: unknown } ? never : NoPayload);

// Fetch prohibits bodies on GET/HEAD, even when an OpenAPI document describes one.
type MethodPayload<Operation, Method extends string> =
  Uppercase<Method> extends 'GET' | 'HEAD'
    ? Operation extends { requestBody: unknown }
      ? never
      : NoPayload
    : PayloadOptions<Operation>;

type OperationOptions<Operation, Method extends string> = Omit<ClientOptions, 'headers'> &
  ParameterOption<'params', ParameterOf<Operation, 'path'>> &
  ParameterOption<'query', ParameterOf<Operation, 'query'>> &
  ParameterOption<'cookies', ParameterOf<Operation, 'cookie'>> &
  HeaderOptions<Operation> &
  MethodPayload<Operation, Method>;

// A variable path can select several operations. Its options must be valid for each one.
type OperationArguments<Operation, Method extends string> = Operation extends unknown
  ? (options: OperationOptions<Operation, Method>) => void
  : never;
export type FetchOptions<Operation, Method extends string = string> = [Operation] extends [never]
  ? never
  : OperationArguments<Operation, Method> extends (options: infer Options) => void
    ? Options
    : never;

export interface RuntimeOptions extends Omit<ClientOptions, 'headers'> {
  method?: string;
  headers?: NativeHeaders | Record<string, unknown>;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  cookies?: Record<string, unknown>;
  body?: unknown;
}

/** Builds a Fetch request without constructing a Request or consuming the native response. */
export async function request(
  path: string,
  options: RuntimeOptions,
  defaults: ClientOptions,
): Promise<Response> {
  const {
    baseUrl = '',
    fetch: fetcher = globalThis.fetch,
    headers: extraHeaders,
    querySerializer,
    pathSerializer = pathParameters,
    params = {},
    query = {},
    cookies = {},
    body,
    method = 'GET',
    ...nativeOptions
  } = { ...defaults, ...options };

  if (typeof fetcher !== 'function')
    throw new TypeError('Fetch is unavailable; provide createClient({ fetch }).');
  if (!path.startsWith('/') || path.startsWith('//') || /[?#]/.test(path))
    throw new TypeError('Use a route path starting with /; pass query values through query.');

  const pathname = pathSerializer(path, params);
  if (!pathname.startsWith('/') || pathname.startsWith('//') || /[{}?#]/.test(pathname))
    throw new TypeError('Path serializer must return a local path with all parameters resolved.');
  const search =
    typeof querySerializer === 'function'
      ? querySerializer(query)
      : queryParameters(query, querySerializer);
  const queryString = search.replace(/^\?/, '');
  const url = baseUrl.replace(/\/$/, '') + pathname + (queryString ? '?' + queryString : '');

  const headers = requestHeaders(defaults.headers, extraHeaders, cookies);
  const init: RequestInit & { duplex?: 'half' } = { ...nativeOptions, method, headers };
  const encoded = encodeBody(body, headers);
  if (encoded !== undefined) init.body = encoded;
  if (typeof ReadableStream !== 'undefined' && init.body instanceof ReadableStream)
    init.duplex = 'half';
  if (/^(get|put|post|delete|options|head|patch|trace|query)$/i.test(method))
    init.method = method.toUpperCase();
  return fetcher(url, init);
}
