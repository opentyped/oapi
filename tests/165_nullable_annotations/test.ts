/** @schema */
export interface Model {
  /** @nullable */
  flag: string;
  /** @nullable true */
  enabled: string;
  /**
   * @nullable false
   * @minLength 2
   */
  disabled: string;
  /** @nullable false */
  explicit: string | null;
  /**
   * Lifecycle state.
   * @nullable
   * @default "active"
   * @examples [null,"active"]
   * @extensions {"x-role":"state"}
   */
  literal: 'active';
  /** @nullable true */
  numeric: 1;
  optional?: string;
}

/** @route GET /nullable-object */
export interface NullableObject {
  responses: {
    200: {
      /**
       * @nullable
       * @http {"example":null}
       * @extensions {"x-owner":"nullable"}
       */
      body: { id: string };
    };
  };
}

interface Pair<T> {
  /** @nullable */
  maybe: T;
  plain: T;
}
/** @schema */
export interface Shared {
  /** @inline */
  value: Pair<'active' | 'inactive'>;
}
