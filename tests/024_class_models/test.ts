/** @schema */
export class Model {
  manager?: Model;
  #cache = new Map<string, unknown>();
  #internal: unknown = null;
  static readonly version = 1;

  constructor(public readonly id: string) {}

  label(): string {
    return this.id;
  }

  get summary(): string {
    return this.#internal === null ? this.id : 'pending';
  }

  reset(): void {
    this.#cache.clear();
    this.#internal = null;
  }
}
