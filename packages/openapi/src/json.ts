import { types } from 'node:util';
import { GenerationError } from '~/diagnostic';

export type JsonValue =
  null | boolean | number | string | readonly JsonValue[] | { [key: string]: JsonValue };
export type Extensions = { [key: `x-${string}`]: JsonValue };

/** Stable key order makes output reproducible across compiler/filesystem traversal order. */
export function stableJson(value: unknown): string {
  return (
    JSON.stringify(
      value,
      (_key, item: unknown) => {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          return Object.fromEntries(
            Object.entries(item).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
          );
        }
        return item;
      },
      2,
    ) + '\n'
  );
}

/** Checks the JavaScript representation before cloning or serializing generated JSON. */
export function validateJson(value: unknown, context = 'JSON data'): void {
  let nodes = 0;
  const visit = (value: unknown, active: Set<object>, depth: number): void => {
    if (depth > 200 || ++nodes > 1000000)
      throw new GenerationError(`${context} exceeds the JSON traversal budget.`);
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
    if (typeof value === 'number' && Number.isFinite(value)) return;
    if (!value || typeof value !== 'object')
      throw new GenerationError(`${context} must contain finite JSON values only.`);
    if (types.isProxy(value)) throw new GenerationError(`${context} cannot contain proxy objects.`);
    if (active.has(value))
      throw new GenerationError(
        `${context} cannot contain circular JavaScript objects. Use schema references.`,
      );
    const array = Array.isArray(value);
    if (
      !(array ? [Array.prototype] : [Object.prototype, null]).includes(Object.getPrototypeOf(value))
    )
      throw new GenerationError(`${context} must contain plain JSON objects and arrays.`);
    if (Object.getOwnPropertySymbols(value).length)
      throw new GenerationError(`${context} cannot contain symbol properties.`);
    if (array) {
      if (value.length > 1000000)
        throw new GenerationError(`${context} exceeds the JSON traversal budget.`);
      for (let index = 0; index < value.length; index++)
        if (!Object.hasOwn(value, index))
          throw new GenerationError(`${context} cannot contain sparse arrays.`);
    }
    const branch = new Set(active).add(value);
    for (const [name, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
      if (descriptor.get || descriptor.set)
        throw new GenerationError(`${context} cannot contain getters or setters.`);
      if (array && name === 'length') continue;
      if (!descriptor.enumerable)
        throw new GenerationError(`${context} cannot contain non-enumerable properties.`);
      if (array && (!/^(0|[1-9]\d*)$/.test(name) || Number(name) >= value.length))
        throw new GenerationError(`${context}: arrays can only contain indexed JSON values.`);
      visit(descriptor.value, branch, depth + 1);
    }
  };
  visit(value, new Set(), 0);
}
