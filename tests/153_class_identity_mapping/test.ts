class Entity {
  /** @minLength 2 */
  id: string = '';
  name?: string;
  save(): void {
    this.id = this.id.trim();
  }
}
/** @schema */
export type Builtin = Readonly<Entity>;
/** @schema */
export type Written = { readonly [K in keyof Entity]: Entity[K] };
/** @schema */
export type Data = Omit<Entity, 'save'>;

/** @schema */
export type Remapped = { readonly [K in keyof Entity as K]: Entity[K] };
