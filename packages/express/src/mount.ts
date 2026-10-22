import type { ServerObject } from 'openapi3-ts/oas32';
import type { Extensions } from '@opentyped/oapi-openapi/json';
import type { Response as ContractResponse } from '~/response';
import type { NextFunction, Request, RequestHandler, ErrorRequestHandler, IRouter } from 'express';
import type {
  HttpContract,
  HttpInput,
  JsonContract,
  Part,
  RequestBody,
  RequestQuery,
  ResponseBody,
} from '@opentyped/oapi-openapi/contract';

/** Express's standard generics connected to the same contract used for generation.
 * @openapiContract
 */
export type ExpressHandler<C extends HttpContract> = RequestHandler<
  Part<C, 'params', Request['params']>,
  ResponseBody<C>,
  RequestBody<C>,
  RequestQuery<C, Request['query']>
>;

type HeaderNames<T> = {
  [K in keyof T as K extends string ? Lowercase<K> : K]: T[K];
};
type ContractRequest<C extends HttpContract> = Omit<
  Request<
    Part<C, 'params', Request['params']>,
    ResponseBody<C>,
    RequestBody<C>,
    RequestQuery<C, Request['query']>
  >,
  'headers' | 'cookies'
> & {
  headers: Omit<Request['headers'], keyof HeaderNames<Part<C, 'headers', object>>> &
    HeaderNames<Part<C, 'headers', object>>;
  cookies: Part<C, 'cookies', Request['cookies']>;
};

export interface Handler<C extends HttpContract> {
  operationId?: string;
  requestContentType?: string;
  servers?: readonly ServerObject[];
  extensions?: Extensions;
  externalDocs?: { url: string; description?: string };
  tags?: readonly string[];
  deprecated?: boolean;
  security?: readonly Record<string, readonly string[]>[];
  summary?: string;
  description?: string;
  handler(request: ContractRequest<C>, response: ContractResponse<C>, next: NextFunction): unknown;
}
/** Express's middleware forms, using only its public handler types. */
type NativeMiddleware<C extends HttpContract> =
  | RequestHandler
  | ErrorRequestHandler
  | ExpressHandler<C>
  | ErrorRequestHandler<
      Part<C, 'params', Request['params']>,
      ResponseBody<C>,
      RequestBody<C>,
      RequestQuery<C, Request['query']>
    >;
export type Middleware<C extends HttpContract = HttpContract> =
  NativeMiddleware<C> | readonly Middleware<C>[];

// Express registers these Node methods, but its published router types omit them.
type HttpMethod =
  | Uppercase<Exclude<keyof IRouter, 'all' | 'param' | 'use' | 'route' | 'stack'>>
  | 'ACL'
  | 'BIND'
  | 'MKCALENDAR'
  | 'REBIND'
  | 'SOURCE'
  | 'UNBIND';
type CoreMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD' | 'TRACE';

export interface Endpoint<
  C extends HttpContract,
  M extends Middleware<C> = ExpressHandler<C>,
> extends Handler<C> {
  method: HttpMethod | 'QUERY';
  path: string;
  /** Runs before the endpoint using Express's ordinary middleware semantics. */
  middleware?: readonly M[];
}
type RouterMiddleware =
  RequestHandler | ErrorRequestHandler | (RequestHandler | ErrorRequestHandler)[];
type Register = (path: string, ...handlers: RouterMiddleware[]) => unknown;
/** Structural registration target: Express itself is never imported at runtime. */
export type Router = {
  [M in Lowercase<CoreMethod>]: Register;
} & { [M in Lowercase<Exclude<HttpMethod | 'QUERY', CoreMethod>>]?: Register };

/** Register a route and expose its contract to build-time analysis.
 * @openapiMount
 */
export function mount<C extends HttpContract>(router: Router, endpoint: Endpoint<C>): void;
/** Native middleware arrays and error handlers.
 * @openapiMount
 */
export function mount<C extends HttpContract>(
  router: Router,
  endpoint: Endpoint<C, Middleware<C>>,
): void;
/** Request fields and a JSON 200 response supplied as separate types.
 * @openapiMount
 */
export function mount<I extends HttpInput, O>(
  router: Router,
  endpoint: Endpoint<JsonContract<I, O>>,
): void;
/** Input/Output shorthand with native middleware forms.
 * @openapiMount
 */
export function mount<I extends HttpInput, O>(
  router: Router,
  endpoint: Endpoint<JsonContract<I, O>, Middleware<JsonContract<I, O>>>,
): void;
export function mount(
  router: Router,
  endpoint: {
    method: Endpoint<HttpContract>['method'];
    path: string;
    middleware?: readonly unknown[];
    handler: unknown;
  },
): void {
  const method = endpoint.method.toLowerCase() as Lowercase<Endpoint<HttpContract>['method']>;
  router[method]!(
    endpoint.path,
    ...((endpoint.middleware ?? []) as RouterMiddleware[]),
    endpoint.handler as RequestHandler,
  );
}

/** A transparent handler wrapper for direct app/router registration.
 * @openapiHandler
 */
export function handler<C extends HttpContract>(options: Handler<C>): ExpressHandler<C>;
/** Request fields and a JSON 200 response supplied as separate types.
 * @openapiHandler
 */
export function handler<I extends HttpInput, O>(
  options: Handler<JsonContract<I, O>>,
): ExpressHandler<JsonContract<I, O>>;
export function handler(options: { handler: unknown }): unknown {
  return options.handler;
}

export default { mount, handler };
