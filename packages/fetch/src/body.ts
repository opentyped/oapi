export type NativeBody = Exclude<RequestInit['body'], undefined | null>;
export type JsonMediaType = 'application/json' | `${string}/${string}+json`;

type Trim<Value extends string> = Value extends ` ${infer Rest}`
  ? Trim<Rest>
  : Value extends `${infer Rest} `
    ? Trim<Rest>
    : Value;
export type MediaType<Value extends string> = Lowercase<
  Trim<Value extends `${infer Name};${string}` ? Name : Value>
>;
export type ContentType<Value extends string> = Value extends `${infer Name};${infer Parameters}`
  ? `${MediaType<Name>};${Trim<Parameters>}`
  : MediaType<Value>;
type JsonMedia<Media extends string> = MediaType<Media> extends JsonMediaType ? Media : never;
type NonJsonMedia<Media extends string> = MediaType<Media> extends JsonMediaType ? never : Media;

// Native bodies and custom toJSON transforms must not masquerade as wire data.
type BodyMethod = 'arrayBuffer' | 'append' | 'getReader' | 'slice' | 'toJSON';
type JsonObject<Value> = { [Key in BodyMethod as Key extends keyof Value ? never : Key]?: never };
type JsonInput<Value> = Value extends readonly unknown[]
  ? { readonly [Key in keyof Value]: JsonInput<Value[Key]> }
  : Value extends object
    ? { readonly [Key in keyof Value]: JsonInput<Value[Key]> } & JsonObject<Value>
    : Value;
type AutomaticJson<Value> = Value extends object ? JsonInput<Value> : never;
type MediaHeader<Allowed extends string> = {
  'Content-Type'?: Allowed;
  'content-type'?: Allowed;
} & Record<string, unknown>;
type OptionalMediaHeader<Allowed extends string> = {
  headers?: Headers | [string, string][] | MediaHeader<Allowed>;
};
type RequiredMediaHeader<Allowed extends string> = {
  headers: MediaHeader<Allowed> & ({ 'Content-Type': Allowed } | { 'content-type': Allowed });
};
type RawNativeBody = Exclude<NativeBody, { uri: string }>;
type FormBody = InstanceType<typeof FormData>;
type SearchBody = RequestInit['body'] & {
  append(name: string, value: string): void;
  sort(): void;
  toString(): string;
};

type JsonBody<Value, Media extends string, Allowed extends string> =
  | ({ body: RequestBody<JsonInput<Value>, Allowed> } & OptionalMediaHeader<Allowed>)
  | ({ body: AutomaticJson<Value> } & (Media extends 'application/json'
      ? { headers?: MediaHeader<Allowed> }
      : RequiredMediaHeader<Allowed>));
type NativeMediaBody<Value, Media extends string, Allowed extends string> =
  | ({ body: RequestBody<Value | NativeBody, Allowed> } & OptionalMediaHeader<Allowed>)
  | ({ body: RawNativeBody } & RequiredMediaHeader<Allowed>)
  | (Media extends 'text/plain' ? { body: string } & OptionalMediaHeader<Allowed> : never)
  | (Media extends 'multipart/form-data' ? { body: FormBody; headers?: MediaHeader<never> } : never)
  | (Media extends 'application/x-www-form-urlencoded'
      ? { body: SearchBody } & OptionalMediaHeader<Allowed>
      : never);

// Do not let a general media type swallow a separately declared parameterized representation.
type MediaFamily<Content, Media extends string> =
  | ContentType<Media>
  | (Extract<keyof Content, `${MediaType<Media>};${string}`> extends never
      ? `${ContentType<Media>};${string}`
      : never);
export type BodyFor<Content> = {
  [Media in keyof Content & string]: [Content[Media]] extends [never | undefined]
    ? never
    : MediaType<Media> extends JsonMediaType
      ? JsonBody<Content[Media], ContentType<Media>, MediaFamily<Content, Media>>
      : NativeMediaBody<Content[Media], ContentType<Media>, MediaFamily<Content, Media>>;
}[keyof Content & string];

function mediaType(value: string): string {
  const name = value.split(';', 1)[0]!.trim().toLowerCase();
  if (!/^[!#$%&'*+.^_`|~\w-]+\/[!#$%&'*+.^_`|~\w-]+$/.test(name) || /[\r\n]/.test(value))
    throw new TypeError(`Invalid request content type: ${value}.`);
  return name;
}

function isJson(media: string): boolean {
  return media === 'application/json' || media.endsWith('+json');
}

function isFormData(value: unknown): boolean {
  return (
    (typeof FormData !== 'undefined' && value instanceof FormData) ||
    Object.prototype.toString.call(value) === '[object FormData]'
  );
}

function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value) as { constructor?: { name?: string } } | null;
  if (prototype === null || prototype === Object.prototype) return true;
  return Object.getPrototypeOf(prototype) === null && prototype.constructor?.name === 'Object';
}

function isNativeBody(value: unknown): boolean {
  if (typeof value === 'string' || value === null) return true;
  if (
    typeof ArrayBuffer !== 'undefined' &&
    (value instanceof ArrayBuffer || ArrayBuffer.isView(value))
  )
    return true;
  if (typeof Blob !== 'undefined' && value instanceof Blob) return true;
  if (typeof URLSearchParams !== 'undefined' && value instanceof URLSearchParams) return true;
  if (typeof ReadableStream !== 'undefined' && value instanceof ReadableStream) return true;
  if (isFormData(value)) return true;
  return /^\[object (Blob|File|ArrayBuffer|URLSearchParams|ReadableStream)\]$/.test(
    Object.prototype.toString.call(value),
  );
}

/** Carries the original value and media types while encoding only at the Fetch boundary. */
export class RequestBody<Value, Media extends string> {
  // Protected annotations survive .d.ts emission and preserve both generic arguments.
  declare protected readonly valueType: Value;
  declare protected readonly mediaType: Media;

  private constructor(
    readonly contentType: string,
    private readonly encoder: () => NativeBody,
  ) {
    mediaType(contentType);
  }

  static fromJSON<const Value>(value: Value): RequestBody<Value, 'application/json'>;
  static fromJSON<const Value, const Media extends string>(
    value: Value,
    contentType: JsonMedia<Media>,
  ): RequestBody<Value, ContentType<Media>>;
  static fromJSON(value: unknown, contentType = 'application/json'): RequestBody<unknown, string> {
    if (!isJson(mediaType(contentType)))
      throw new TypeError('fromJSON requires a JSON content type.');
    return new RequestBody(contentType, () => {
      const encoded = JSON.stringify(value);
      if (encoded === undefined) throw new TypeError('The request body is not JSON serializable.');
      return encoded;
    });
  }

  static fromText(value: string): RequestBody<string, 'text/plain'>;
  static fromText<const Media extends string>(
    value: string,
    contentType: NonJsonMedia<Media>,
  ): RequestBody<string, ContentType<Media>>;
  static fromText(value: string, contentType = 'text/plain'): RequestBody<string, string> {
    if (isJson(mediaType(contentType))) throw new TypeError('Use fromJSON to encode JSON values.');
    return new RequestBody(contentType, () => value);
  }

  static fromNative<const Media extends string>(
    value: NativeBody,
    contentType: NonJsonMedia<Media>,
  ): RequestBody<NativeBody, ContentType<Media>> {
    if (isJson(mediaType(contentType))) throw new TypeError('Use fromJSON to encode JSON values.');
    return new RequestBody(contentType, () => value);
  }

  static encode<const Value, const Media extends string>(
    value: Value,
    contentType: NonJsonMedia<Media>,
    encoder: (value: Value) => NativeBody,
  ): RequestBody<Value, ContentType<Media>> {
    if (isJson(mediaType(contentType))) throw new TypeError('Use fromJSON to encode JSON values.');
    return new RequestBody(contentType, () => encoder(value));
  }

  toBody(headers: Headers): NativeBody {
    const expected = mediaType(this.contentType);
    const existing = headers.get('content-type');
    if (existing) {
      const normalize = (value: string): string => {
        const separator = value.indexOf(';');
        if (separator < 0) return mediaType(value);
        return mediaType(value) + ';' + value.slice(separator + 1).trim();
      };
      if (normalize(existing) !== normalize(this.contentType))
        throw new TypeError(
          `RequestBody content type ${this.contentType} conflicts with ${existing}.`,
        );
    }
    const body = this.encoder();
    if (isFormData(body)) {
      if (expected !== 'multipart/form-data')
        throw new TypeError('FormData requires multipart/form-data.');
      if (existing) throw new TypeError('Let Fetch set the multipart boundary for FormData.');
    } else if (!existing) headers.set('content-type', this.contentType);
    return body;
  }
}

/** One body field: typed encodings, plain JSON data, or unmodified native payloads. */
export function encodeBody(value: unknown, headers: Headers): RequestInit['body'] {
  if (value === undefined) return undefined;
  if (value instanceof RequestBody) return value.toBody(headers);
  if (
    Array.isArray(value) ||
    (value !== null && typeof value === 'object' && isPlainObject(value))
  ) {
    const contentType = headers.get('content-type');
    const media = contentType ? mediaType(contentType) : 'application/json';
    if (!isJson(media))
      throw new TypeError(
        'Plain objects and arrays default to JSON; use a RequestBody encoder for other content.',
      );
    return RequestBody.fromJSON(
      value,
      (contentType ?? media) as JsonMediaType | `${JsonMediaType};${string}`,
    ).toBody(headers);
  }
  if (!isNativeBody(value))
    throw new TypeError('Unsupported body; use a RequestBody encoder for custom values.');
  const contentType = headers.get('content-type');
  if (contentType && isJson(mediaType(contentType)))
    throw new TypeError('JSON bodies require a typed value or RequestBody.fromJSON.');
  if (isFormData(value) && contentType)
    throw new TypeError('Let Fetch set the multipart boundary for FormData.');
  return value as RequestInit['body'];
}
