interface Access<T> {
  /** @minLength 1 */
  get value(): T;
  set count(value: number);
  /** @hidden */
  get hidden(): unknown;
}
interface Child extends Access<string> {
  get previous(): Child | null;
}
class Example {
  id: string = '';
  get computed(): string {
    return this.id;
  }
}
/** @schema */
export interface Model {
  child: Child;
  inline: {
    /** @minLength 2 */
    get label(): string;
    set enabled(value: boolean);
  };
  example: Example;
}
