import type { Response as ExpressResponse } from 'express';
import type {
  HttpContract,
  ContentBody,
  Part,
  ResponseStatus,
  ResponseAtStatus,
} from '@typedapi/openapi/contract';

type TrimMedia<T extends string> = T extends `${' ' | '\t'}${infer V}`
  ? TrimMedia<V>
  : T extends `${infer V}${' ' | '\t'}`
    ? TrimMedia<V>
    : T;
type Media<T extends string> = Lowercase<TrimMedia<T extends `${infer M};${string}` ? M : T>>;
type JsonTypes = 'application/json' | `${string}+json` | 'application/*' | '*/*';
type JsonMedia<T extends string> = Media<T> extends JsonTypes ? true : false;
type ContentMap<T> = NonNullable<Part<T, 'content'>>;
// Broad framework handlers stay usable; concrete maps select only matching representations.
type MediaKeys<T, Allowed extends string> = {
  [K in keyof ContentMap<T>]-?: K extends string
    ? string extends K
      ? K
      : Media<K> extends Allowed
        ? K
        : never
    : never;
}[keyof ContentMap<T>];
type MediaBody<T, Allowed extends string> = [MediaKeys<T, Allowed>] extends [never]
  ? never
  : ContentMap<T>[MediaKeys<T, Allowed>] | Extract<Part<T, 'content'>, undefined>;
type JsonBody<T> = T extends unknown
  ? 'content' extends keyof T
    ? MediaBody<T, JsonTypes>
    : JsonMedia<Extract<Part<T, 'contentType', 'application/json'>, string>> extends true
      ? ContentBody<T>
      : never
  : never;

type PlainBody<T> = T extends unknown
  ? 'content' extends keyof T
    ? MediaBody<T, 'text/plain'>
    : T extends { contentType: infer M extends string }
      ? Media<M> extends 'text/plain'
        ? ContentBody<T>
        : never
      : never
  : never;
type SendStatus<C extends HttpContract, N extends number = ResponseStatus<C>> = N extends
  204 | 205 | 304
  ? Exclude<ContentBody<ResponseAtStatus<C, N>>, undefined> extends never
    ? N
    : never
  : string extends PlainBody<ResponseAtStatus<C, N>>
    ? N
    : never;

type FluentReturn<R, C extends HttpContract, S extends number> =
  R extends ExpressResponse<never> ? Response<C, S> : R;
// Preserve Express's overloaded fluent methods, including cookie/header/end.
type Fluent<T, C extends HttpContract, S extends number> = T extends {
  (...args: infer A): infer R;
  (...args: infer B): infer U;
  (...args: infer D): infer V;
}
  ? R | U | V extends ExpressResponse<never>
    ? {
        (...args: A): FluentReturn<R, C, S>;
        (...args: B): FluentReturn<U, C, S>;
        (...args: D): FluentReturn<V, C, S>;
      }
    : T
  : T;
export type Response<C extends HttpContract, S extends number = 200> = {
  [
    K in keyof Omit<
      ExpressResponse<ContentBody<ResponseAtStatus<C, S>>>,
      'status' | 'sendStatus' | 'json' | 'jsonp'
    >
  ]: Fluent<ExpressResponse<ContentBody<ResponseAtStatus<C, S>>>[K], C, S>;
} & {
  json(body: JsonBody<ResponseAtStatus<C, S>>): Response<C, S>;
  jsonp(body: JsonBody<ResponseAtStatus<C, S>>): Response<C, S>;
  status<N extends ResponseStatus<C>>(status: N): Response<C, N>;
  sendStatus<N extends SendStatus<C>>(status: N): Response<C, N>;
};
