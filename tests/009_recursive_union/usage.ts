import type { Model } from 'openapi/models';
export const value: Model = { nested: ['text', 42, null, { enabled: true }] };
// @ts-expect-error Functions cannot be JSON values.
export const invalid: Model = { callback: () => 1 };
