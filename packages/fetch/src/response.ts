import type { JsonContent, MediaContent, ResponsesOf } from '~/operation';

/** No wrapper at runtime: only the native response's type changes. */
export type TypedResponse<Body, Status extends number, Ok extends boolean> = Omit<
  Response,
  'json' | 'status' | 'ok' | 'clone'
> & {
  readonly status: Status;
  readonly ok: Ok;
  json(): Promise<Body>;
  clone(): TypedResponse<Body, Status, Ok>;
};

type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
type StatusClass = Exclude<Digit, '0'>;
type StatusNumber<Value> = Value extends `${infer Status extends number}` ? Status : never;

// Enumerating wire statuses lets TypeScript exclude known codes from the unknown fallback.
// Zero represents an opaque/error response; nonstandard three-digit codes stay unknown too.
type HttpStatus = 0 | StatusNumber<`${StatusClass}${Digit}${Digit}`>;
type SuccessStatus = StatusNumber<`2${Digit}${Digit}`>;

type StatusCodes<Key> = Key extends number
  ? Key
  : Key extends `${infer Class extends '1' | '2' | '3' | '4' | '5'}XX`
    ? StatusNumber<`${Class}${Digit}${Digit}`>
    : StatusNumber<Key>;

type ExplicitStatuses<Operation> = StatusCodes<
  Exclude<keyof ResponsesOf<Operation>, 'default' | `${string}XX`>
>;
type CoveredStatuses<Operation> = StatusCodes<Exclude<keyof ResponsesOf<Operation>, 'default'>>;

type JsonResponseBody<Value> = [MediaContent<Value>] extends [never]
  ? never
  : [JsonContent<MediaContent<Value>>] extends [never]
    ? unknown
    : JsonContent<MediaContent<Value>>;

type SuccessBranch<Body, Status> = [Extract<Status, SuccessStatus>] extends [never]
  ? never
  : TypedResponse<Body, Extract<Status, SuccessStatus>, true>;

type ErrorStatuses<Status> = Exclude<Extract<Status, number>, SuccessStatus>;
type ErrorBranch<Body, Status> = [ErrorStatuses<Status>] extends [never]
  ? never
  : TypedResponse<Body, ErrorStatuses<Status>, false>;

type ResponseBranch<Body, Status> = SuccessBranch<Body, Status> | ErrorBranch<Body, Status>;

type StatusesFor<Operation, Key> = Key extends `${string}XX`
  ? Exclude<StatusCodes<Key>, ExplicitStatuses<Operation>>
  : StatusCodes<Key>;

type DeclaredResponses<Operation> = {
  [Key in Exclude<keyof ResponsesOf<Operation>, 'default'>]: ResponseBranch<
    JsonResponseBody<ResponsesOf<Operation>[Key]>,
    StatusesFor<Operation, Key>
  >;
}[Exclude<keyof ResponsesOf<Operation>, 'default'>];

type DefaultBody<Operation> = 'default' extends keyof ResponsesOf<Operation>
  ? JsonResponseBody<ResponsesOf<Operation>['default']>
  : unknown;

type UndocumentedResponse<Operation> = ResponseBranch<
  DefaultBody<Operation>,
  Exclude<HttpStatus, CoveredStatuses<Operation>>
>;

/** Exact statuses override ranges. Undocumented bodies stay unknown unless default is declared. */
export type ClientResponse<Operation, Method extends string = string> =
  Uppercase<Method> extends 'HEAD'
    ? ResponseBranch<never, HttpStatus>
    : DeclaredResponses<Operation> | UndocumentedResponse<Operation>;
