export { RequestBody } from '~/body';
import { request } from '~/request';
import type { ClientOptions, FetchOptions, RuntimeOptions } from '~/request';
import type { MethodsFor, OperationAt, PathsFor, RequiredKeys } from '~/operation';
import type { ClientResponse } from '~/response';

export type { ClientOptions, Fetch, FetchOptions } from '~/request';
export type { ClientResponse, TypedResponse } from '~/response';
export type { QuerySerializerOptions, QuerySerializer, PathSerializer } from '~/serialize';

type GetOptions<Operation> = FetchOptions<Operation, 'GET'> & { method?: 'GET' | 'get' };
type GetArguments<Operation> = [GetOptions<Operation>] extends [never]
  ? [options: never]
  : [RequiredKeys<GetOptions<Operation>>] extends [never]
    ? [options?: GetOptions<Operation>]
    : [options: GetOptions<Operation>];

// Distribute method unions so a possible GET cannot accidentally accept a POST payload.
type MethodOptions<Schema, Path extends keyof Schema, Method extends string> = Method extends string
  ? { method: Method } & FetchOptions<OperationAt<Schema, Path, Method>, Method>
  : never;

export interface Client<Schema> {
  <Path extends PathsFor<Schema, 'GET'>>(
    path: Path,
    ...options: GetArguments<OperationAt<Schema, NoInfer<Path>, 'GET'>>
  ): Promise<ClientResponse<OperationAt<Schema, Path, 'GET'>, 'GET'>>;

  <Path extends keyof Schema & string, Method extends MethodsFor<Schema, NoInfer<Path>>>(
    path: Path,
    options: { method: Method } & MethodOptions<Schema, NoInfer<Path>, NoInfer<Method>>,
  ): Promise<ClientResponse<OperationAt<Schema, Path, Method>, Method>>;
}

/** Callable Fetch: request types are erased and the response is never wrapped or consumed. */
export function createClient<Schema>(options: ClientOptions = {}): Client<Schema> {
  const client = (path: string, init: RuntimeOptions = {}): Promise<Response> =>
    request(path, init, options);
  return client as unknown as Client<Schema>;
}

export default createClient;
