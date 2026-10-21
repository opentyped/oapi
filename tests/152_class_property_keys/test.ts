/** @schema */
export class Entity {
  /** @minLength 2 */
  id: string = '';
  /** @hidden */
  internal?: unknown;
  static version = 1;
  save(): void {
    this.id = this.id.trim();
  }
  get label(): string {
    return this.id;
  }
}
interface Other {
  id: number;
  internal?: string;
  save: () => void;
  label: string;
}
type KeysOf<T> = keyof T;
/** @schema */
export type Keys = keyof Entity;
/** @schema */
export type GenericKeys = KeysOf<Entity>;
/** @schema */
export type UnionKeys = KeysOf<Entity | Other>;
/** @schema */
export type Labels = { [K in keyof Entity]: string };
