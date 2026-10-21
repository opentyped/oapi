import { GenerationError } from '@typedapi/openapi/diagnostic';
import type { ResolvedConfig, ViteDevServer } from 'vite';
import type { Generation } from '@typedapi/compiler/config';
import { DocumentEndpoint } from '~/endpoint';
import { DocumentSnapshot } from '~/snapshot';
import { SourceWatcher } from '~/watcher';

/** Composes development generation, watching, notifications, and document transport. */
export function serveDocuments(
  server: ViteDevServer,
  config: ResolvedConfig,
  directory: string,
  regenerate: () => Generation,
  outputs: readonly string[] = [],
): () => Promise<void> {
  const snapshot = new DocumentSnapshot();
  let watchFailure: Error | undefined;
  const report = (error: Error): void => {
    snapshot.failure = error;
    config.logger.error(`[typedapi] ${error.message}`);
    server.ws.send({
      type: 'error',
      err: { message: error.message, stack: error.stack ?? '', plugin: 'typedapi' },
    });
  };
  const refresh = (): void => {
    snapshot.refresh(regenerate);
    if (watchFailure) snapshot.failure = watchFailure;
    if (snapshot.failure) {
      const failure = snapshot.failure;
      if (failure instanceof GenerationError) watcher.track(failure.files, failure.watchRoots);
      report(failure);
      return;
    }
    const result = snapshot.result!;
    watcher.track(result.files, result.watchRoots);
    server.ws.send({
      type: 'custom',
      event: 'typedapi:update',
      data: { paths: Object.keys(result.document.paths).length },
    });
  };
  const watcher = new SourceWatcher(config, refresh, (error) => {
    watchFailure = error;
    report(error);
  });
  for (const output of outputs) watcher.excludeOutput(output);
  watcher.start();
  refresh();
  server.httpServer?.once('close', () => {
    void watcher.close().catch(report);
  });
  server.middlewares.use(new DocumentEndpoint(config.base, directory, snapshot).handle);
  return watcher.close;
}
