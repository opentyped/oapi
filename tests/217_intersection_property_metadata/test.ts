interface Left {
  /**
   * Inline merged value.
   * @inline
   * @readOnly
   * @extensions {"x-origin":"left"}
   */
  value: {
    /** @minLength 1 */
    name: string;
  };
}
interface Right {
  value: {
    /** @minimum 0 */
    count: number;
  };
}
/** @schema */
export type Model = Left & Right;
