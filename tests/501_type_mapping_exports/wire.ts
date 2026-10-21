export default class Opaque<T> {
  value!: T;
  toJSON(): string {
    throw new Error('Generation must not execute serialization');
  }
}
export { Opaque };
