/** @schemaName custom.NoInfer */
interface NoInfer<T> {
  own: T;
}
export interface Shadow {
  value: NoInfer<boolean>;
}
import InferenceBarrier = globalThis.NoInfer;
export type { InferenceBarrier };
