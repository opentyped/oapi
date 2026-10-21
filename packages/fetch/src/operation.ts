import type { JsonMediaType, MediaType } from '~/body';
export type StandardMethod =
  'GET' | 'PUT' | 'POST' | 'DELETE' | 'OPTIONS' | 'HEAD' | 'PATCH' | 'TRACE' | 'QUERY';

export type Property<Value, Name extends PropertyKey> = Name extends keyof Value
  ? Value[Name]
  : never;

export type RequiredKeys<Value> = {
  [Name in keyof Value]-?: Record<never, never> extends Pick<Value, Name> ? never : Name;
}[keyof Value];

export type OperationAt<Schema, Path extends keyof Schema, Method extends string> =
  Lowercase<Method> extends keyof Schema[Path]
    ? NonNullable<Schema[Path][Lowercase<Method>]>
    : NonNullable<Property<NonNullable<Property<Schema[Path], 'additionalOperations'>>, Method>>;

type UnsupportedPaths<
  Schema,
  Path extends keyof Schema,
  Method extends string,
> = Path extends keyof Schema
  ? [OperationAt<Schema, Path, Method>] extends [never]
    ? Path
    : never
  : never;

type StandardMethodsFor<Schema, Path extends keyof Schema> = {
  [Method in StandardMethod]: [UnsupportedPaths<Schema, Path, Method>] extends [never]
    ? Method | Lowercase<Method>
    : never;
}[StandardMethod];

type CustomMethodsFor<PathItem> = [Property<PathItem, 'additionalOperations'>] extends [never]
  ? never
  : keyof NonNullable<Property<PathItem, 'additionalOperations'>> & string;

export type MethodsFor<Schema, Path extends keyof Schema> =
  StandardMethodsFor<Schema, Path> | CustomMethodsFor<Schema[Path]>;

export type PathsFor<Schema, Method extends string> = {
  [Path in keyof Schema]: [OperationAt<Schema, Path, Method>] extends [never] ? never : Path;
}[keyof Schema] &
  string;

export type MediaContent<Value> = Value extends { content: infer Content } ? Content : never;
type JsonKeys<Content> = {
  [Media in keyof Content]: Media extends string
    ? MediaType<Media> extends JsonMediaType
      ? Media
      : never
    : never;
}[keyof Content];
export type JsonContent<Content> = Content extends object ? Content[JsonKeys<Content>] : never;

export type RequestBodyOf<Operation> = NonNullable<Property<Operation, 'requestBody'>>;
export type ResponsesOf<Operation> = NonNullable<Property<Operation, 'responses'>>;
export type ParameterOf<Operation, Location extends string> = NonNullable<
  Property<NonNullable<Property<Operation, 'parameters'>>, Location>
>;
