import type { Generation } from '@typedapi/compiler/config';

/** Keeps a failed generation explicit so consumers cannot mistake stale output for current output. */
export class DocumentSnapshot {
  result: Generation | undefined;
  failure: Error | undefined;

  refresh(regenerate: () => Generation): void {
    try {
      this.result = regenerate();
      this.failure = undefined;
    } catch (error) {
      this.failure = error instanceof Error ? error : new Error(String(error));
    }
  }

  content(file: string): unknown {
    if (file === 'openapi.json') return this.result?.document;
    const match = /^schemas\/([a-zA-Z0-9._-]+)\.json$/.exec(file);
    const name = match?.[1];
    if (name && Object.hasOwn(this.result?.schemas ?? {}, name)) return this.result!.schemas[name];
    return undefined;
  }
}
