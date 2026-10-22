import type { Generation } from '@opentyped/oapi-compiler/config';

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
}
