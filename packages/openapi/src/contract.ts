import { format, parse } from 'content-type';

/** Shape of a marked HTTP operation contract. */
export interface HttpContract {
  params?: object;
  query?: object;
  querystring?: { content: Record<string, unknown> };
  headers?: object;
  cookies?: object;
  callbacks?: object;
  body?: unknown;
  requestBody?: { content: Record<string, unknown> } | StreamRequest<unknown, string>;
  responses: Record<
    string | number,
    {
      body?: unknown;
      itemSchema?: unknown;
      headers?: object;
      contentType?: string;
      content?: Record<string, unknown>;
    }
  >;
}

/** Request fields for the Input/Output endpoint shorthand. */
export type HttpInput = Omit<HttpContract, 'responses'>;
export type JsonContract<I extends HttpInput, O> = I & { responses: { 200: { body: O } } };

export interface JsonResponse<T> {
  body: T;
}

export interface EmptyResponse {
  body?: never;
}

/** Describes each stream item; the application supplies the encoded response bytes. */
export interface StreamResponse<T, Media extends string = 'application/jsonl'> {
  itemSchema: T;
  contentType: Media;
}

// Describes decoded stream items; request bytes remain under application control.
export interface StreamRequest<T, Media extends string = 'application/jsonl'> {
  itemSchema: T;
  contentType: Media;
}

type RequestPayload<T> = T extends { itemSchema: unknown } ? unknown : ContentBody<T>;

export type Part<C, K extends PropertyKey, F = never> = K extends keyof C ? C[K] : F;
type ContentMap<T> = NonNullable<Part<T, 'content'>>;
export type ContentBody<T> = T extends unknown
  ? 'content' extends keyof T
    ? ContentMap<T>[keyof ContentMap<T>] | Extract<Part<T, 'content'>, undefined>
    : Part<T, 'body'>
  : never;
type WholeQuery<C> = Extract<NonNullable<Part<C, 'querystring'>>, { content: object }>;
export type RequestQuery<C extends HttpContract, F = never> = [WholeQuery<C>] extends [never]
  ? Part<C, 'query', F>
  : ContentBody<WholeQuery<C>> | Extract<Part<C, 'querystring'>, undefined>;

export type RequestBody<C extends HttpContract> = C extends { requestBody?: infer R }
  ? RequestPayload<NonNullable<R>> | Extract<Part<C, 'requestBody'>, undefined>
  : Part<C, 'body', unknown>;

export type ResponseBody<C extends HttpContract> = {
  [S in keyof C['responses']]: ContentBody<C['responses'][S]>;
}[keyof C['responses']];

type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
type Hundred = '1' | '2' | '3' | '4' | '5';
type Numeric<S extends string> = S extends `${infer N extends number}` ? N : never;
type HttpStatus = Numeric<`${Hundred}${Digit}${Digit}`>;
export type ResponseStatus<C extends HttpContract> = {
  [S in keyof C['responses']]: S extends number
    ? S
    : S extends `${infer H extends Hundred}XX`
      ? Numeric<`${H}${Digit}${Digit}`>
      : S extends 'default'
        ? HttpStatus
        : S extends string
          ? Numeric<S>
          : never;
}[keyof C['responses']];
type Fallback<
  C extends HttpContract,
  S extends number,
> = `${S}` extends `${infer H extends Hundred}${Digit}${Digit}`
  ? `${H}XX` extends keyof C['responses']
    ? C['responses'][`${H}XX`]
    : Part<C['responses'], 'default'>
  : never;
export type ResponseAtStatus<
  C extends HttpContract,
  S extends number,
> = S extends keyof C['responses']
  ? C['responses'][S]
  : `${S}` extends keyof C['responses']
    ? C['responses'][`${S}`]
    : Fallback<C, S>;
type WireBody<R> = R extends { itemSchema: unknown }
  ? { contentType: Part<R, 'contentType'>; body: ReadableStream<Uint8Array> }
  : 'content' extends keyof R
    ? | {
          [K in keyof ContentMap<R>]-?: { contentType: K; body: ContentMap<R>[K] };
        }[keyof ContentMap<R>]
      | (undefined extends Part<R, 'content'>
          ? | { body?: never; contentType?: never }
            | ('body' extends keyof R ? Pick<R, Extract<keyof R, 'body' | 'contentType'>> : never)
          : never)
    : 'body' extends keyof R
      ? Pick<R, Extract<keyof R, 'body' | 'contentType'>>
      : { body?: never };

type WebStatus<C extends HttpContract> = ResponseStatus<C> &
  Numeric<`${Exclude<Hundred, '1'>}${Digit}${Digit}`>;

export type WebResult<C extends HttpContract> = {
  [S in WebStatus<C>]: {
    status: S;
    headers?: HeadersInit;
  } & WireBody<ResponseAtStatus<C, S>> &
    (S extends 204 | 205 | 304 ? { body?: never } : unknown);
}[WebStatus<C>];

/** Native request view: decoded JSON remains untrusted until the application validates it. */
export type WebRequest = Omit<Request, 'json' | 'clone'> & {
  json(): Promise<unknown>;
  clone(): WebRequest;
};

/** Serializes a typed result using the standard Fetch API. Input validation is the handler's job.
 * @openapiContract
 */
export function webHandler<C extends HttpContract>(
  handler: (request: WebRequest) => WebResult<C> | Promise<WebResult<C>>,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const response = encodeResponse(await handler(request));
    if (request.method !== 'HEAD' || !response.body) return response;
    await response.body.cancel();
    return new Response(null, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  };
}

/** Encodes one representation before request-method handling. */
function encodeResponse(result: {
  status: number;
  headers?: HeadersInit;
  body?: unknown;
  contentType?: unknown;
}): Response {
  const headers = new Headers(result.headers);
  const body = result.body;
  if (body === undefined) return new Response(null, { status: result.status, headers });
  const declared = 'contentType' in result ? String(result.contentType) : 'application/json';
  if (!headers.has('content-type')) headers.set('content-type', declared);
  const actual = parse(headers.get('content-type')!);
  const type = actual.type;
  const expected = parse(declared);
  const parameter = (name: string, value: string): string =>
    name === 'charset' ? value.toLowerCase() : value;
  if (
    type !== expected.type ||
    Object.entries(expected.parameters).some(
      ([name, value]) =>
        actual.parameters[name] === undefined ||
        parameter(name, actual.parameters[name]!) !== parameter(name, value),
    )
  )
    throw new TypeError('Response contentType conflicts with the Content-Type header.');
  if (body instanceof FormData || body instanceof URLSearchParams)
    return formResponse(body, result.status, headers);
  const json = type === 'application/json' || type.endsWith('+json');
  if (
    body instanceof ReadableStream ||
    (!json && (body instanceof Blob || body instanceof ArrayBuffer || ArrayBuffer.isView(body)))
  )
    return new Response(body as BodyInit, { status: result.status, headers });
  if (!json && typeof body !== 'string')
    throw new TypeError(
      'Non-JSON Fetch responses require a string, binary body or byte stream. Use a custom Response for other encodings.',
    );
  return new Response(json ? JSON.stringify(body) : (body as string), {
    status: result.status,
    headers,
  });
}

/** Let Fetch own form encoding and its boundary; retain compatible application parameters. */
function formResponse(
  body: FormData | URLSearchParams,
  status: number,
  headers: Headers,
): Response {
  const media = parse(headers.get('content-type')!);
  const multipart = body instanceof FormData;
  const type = multipart ? 'multipart/form-data' : 'application/x-www-form-urlencoded';
  if (media.type !== type) throw new TypeError(`This Fetch form body requires ${type}.`);
  if (multipart && Object.hasOwn(media.parameters, 'boundary'))
    throw new TypeError('FormData boundaries are generated by Fetch; omit the boundary parameter.');
  if (media.parameters.charset && media.parameters.charset.toLowerCase() !== 'utf-8')
    throw new TypeError('Fetch form bodies require UTF-8 encoding.');
  headers.delete('content-type');
  const response = new Response(body, { status, headers });
  const native = parse(response.headers.get('content-type')!);
  response.headers.set(
    'content-type',
    format({ type, parameters: { ...media.parameters, ...native.parameters } }),
  );
  return response;
}
