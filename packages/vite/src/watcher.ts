import path from 'node:path';
import { lstatSync, watchFile, unwatchFile } from 'node:fs';
import type { Stats } from 'node:fs';
import type { ResolvedConfig } from 'vite';
import { watch } from 'chokidar';
import type { FSWatcher } from 'chokidar';

function localSource(file: string, root: string, outputs: ReadonlySet<string>): boolean {
  const relative = path.relative(root, file);
  return (
    relative !== '..' &&
    !relative.startsWith('..' + path.sep) &&
    !path.isAbsolute(relative) &&
    /\.(?:[cm]?tsx?|json)$/.test(file) &&
    !relative
      .split(path.sep)
      .some((part) => ['node_modules', '.git', 'dist', 'generated'].includes(part)) &&
    ![...outputs].some((output) => file === output || file.startsWith(output + path.sep))
  );
}

function dependencyPath(file: string, root: string): boolean {
  const relative = path.relative(root, file);
  return (
    relative.split(path.sep).includes('node_modules') ||
    ((relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) &&
      file.split(path.sep).includes('node_modules'))
  );
}

/** Owns event subscriptions and debouncing, including cancellation on shutdown. */
export class SourceWatcher {
  private files = new Set<string>();
  private readonly outputs = new Set<string>();
  private readonly polledFiles = new Map<string, (current: Stats, previous: Stats) => void>();
  private interval = 100;
  private roots = new Set<string>();
  private parents = new Set<string>();
  private readonly subscribed = new Set<string>();
  private watcher: FSWatcher | undefined;
  private closed = false;
  private closing: Promise<void> | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly config: ResolvedConfig,
    private readonly refresh: () => void,
    private readonly failure: (error: Error) => void,
  ) {
    this.excludeOutput(path.resolve(config.root, config.build.outDir));
  }

  excludeOutput(directory: string): void {
    this.outputs.add(path.resolve(directory));
  }

  track(files: string[], roots: string[] = []): void {
    const previous = this.files;
    this.roots = new Set(roots.map((root) => path.resolve(root)));
    this.files = new Set(files.map((file) => path.resolve(file)));
    this.parents = new Set(this.roots);
    for (const target of [...this.files, ...this.roots]) {
      let parent = path.dirname(target);
      while (!this.parents.has(parent)) {
        this.parents.add(parent);
        const next = path.dirname(parent);
        if (next === parent) break;
        parent = next;
      }
    }
    const paths = new Set([
      ...this.files,
      ...this.roots,
      ...[...this.files].map((file) => path.dirname(file)),
    ]);
    const removed = [...previous].filter(
      (file) =>
        this.subscribed.has(file) &&
        !paths.has(file) &&
        (dependencyPath(file, this.config.root) ||
          ![...this.roots].some((root) => localSource(file, root, this.outputs))),
    );
    if (removed.length) this.watcher?.unwatch(removed);
    for (const file of removed) this.subscribed.delete(file);
    // Chokidar treats the empty basename of a filesystem root as a removed child.
    const rootEntries = new Set(
      [...this.files, ...this.roots].filter((file) => path.dirname(file) === path.parse(file).root),
    );
    // Chokidar can stop observing a symlink after its target disappears.
    const linked = new Map<string, boolean>();
    const throughSymlink = (file: string): boolean => {
      const known = linked.get(file);
      if (known !== undefined) return known;
      const parent = path.dirname(file);
      let symlink = false;
      try {
        symlink = !!lstatSync(file, { throwIfNoEntry: false })?.isSymbolicLink();
      } catch (error) {
        // Invalid tsconfig/import candidates can traverse a regular file.
        if ((error as NodeJS.ErrnoException).code !== 'ENOTDIR') throw error;
      }
      const value = symlink || (parent !== file && throughSymlink(parent));
      linked.set(file, value);
      return value;
    };
    const symlinks = [...this.files].filter(throughSymlink);
    if (this.watcher) this.trackPolledFiles(new Set([...rootEntries, ...symlinks]));
    const additions = [...paths].filter(
      (file) =>
        file !== path.parse(file).root &&
        !(rootEntries.has(file) && this.files.has(file)) &&
        !this.subscribed.has(file),
    );
    for (const file of additions) this.subscribed.add(file);
    if (additions.length) this.watcher?.add(additions);
  }

  start(): void {
    const options =
      this.config.command === 'build' && this.config.build.watch
        ? (this.config.build.watch.chokidar ?? {})
        : this.config.server.watch;
    if (options === null || this.closed || this.watcher) return;
    this.interval = options?.interval ?? 100;
    this.watcher = watch([], {
      ...(options?.usePolling !== undefined ? { usePolling: options.usePolling } : {}),
      ...(options?.interval !== undefined ? { interval: options.interval } : {}),
      ...(options?.binaryInterval !== undefined ? { binaryInterval: options.binaryInterval } : {}),
      ...(options?.awaitWriteFinish !== undefined
        ? {
            awaitWriteFinish:
              typeof options.awaitWriteFinish === 'boolean'
                ? options.awaitWriteFinish
                : {
                    ...(options.awaitWriteFinish.pollInterval !== undefined
                      ? { pollInterval: options.awaitWriteFinish.pollInterval }
                      : {}),
                    ...(options.awaitWriteFinish.stabilityThreshold !== undefined
                      ? { stabilityThreshold: options.awaitWriteFinish.stabilityThreshold }
                      : {}),
                  },
          }
        : {}),
      ...(options?.atomic !== undefined ? { atomic: options.atomic } : {}),
      ignoreInitial: false,
      ignored: (file, stats) => {
        const absolute = path.resolve(file);
        if (absolute === path.parse(absolute).root) return true;
        if (this.files.has(absolute)) return false;
        if ((!stats || stats.isDirectory()) && this.parents.has(absolute)) return false;
        if (dependencyPath(absolute, this.config.root)) return true;
        const scoped = [...this.roots].flatMap((root) => {
          const relative = path.relative(root, absolute);
          return relative === '..' ||
            relative.startsWith('..' + path.sep) ||
            path.isAbsolute(relative)
            ? []
            : [relative];
        });
        if (!scoped.length) return true;
        if (
          scoped.length &&
          scoped.every((relative) =>
            relative
              .split(path.sep)
              .some((part) => ['node_modules', '.git', 'dist', 'generated'].includes(part)),
          )
        )
          return true;
        if (
          [...this.outputs].some(
            (output) => absolute === output || absolute.startsWith(output + path.sep),
          )
        )
          return true;
        return stats?.isFile() ? !/\.(?:[cm]?tsx?|json)$/.test(file) : false;
      },
    });
    this.watcher
      .on('add', this.changed)
      .on('change', this.changed)
      .on('unlink', this.changed)
      .on('addDir', this.changed)
      .on('unlinkDir', this.changed)
      .on('error', (error: unknown) => {
        const cause = error instanceof Error ? error : new Error(String(error));
        if ('code' in cause && ['EMFILE', 'ENOSPC'].includes(String(cause.code))) {
          const option = this.config.command === 'build' ? 'build.watch.chokidar' : 'server.watch';
          this.failure(
            new Error(
              `OpenAPI input watching failed: ${cause.message}. Enable ${option}.usePolling and restart Vite.`,
              { cause },
            ),
          );
        } else this.failure(cause);
      });
  }

  close = (): Promise<void> => {
    this.closed = true;
    for (const [file, listener] of this.polledFiles) unwatchFile(file, listener);
    this.polledFiles.clear();
    clearTimeout(this.timer);
    this.closing ??= this.watcher?.close() ?? Promise.resolve();
    return this.closing;
  };

  private trackPolledFiles(files: ReadonlySet<string>): void {
    for (const [file, listener] of this.polledFiles) {
      if (files.has(file)) continue;
      unwatchFile(file, listener);
      this.polledFiles.delete(file);
    }
    for (const file of files) {
      if (this.polledFiles.has(file)) continue;
      const listener = (current: Stats, previous: Stats): void => {
        if (
          current.mtimeMs !== previous.mtimeMs ||
          current.size !== previous.size ||
          current.ino !== previous.ino ||
          current.nlink !== previous.nlink
        )
          this.changed(file);
      };
      this.polledFiles.set(file, listener);
      watchFile(file, { interval: this.interval }, listener);
    }
  }

  private changed = (file: string): void => {
    if (this.closed) return;
    const absolute = path.resolve(file);
    if (
      !this.files.has(absolute) &&
      !this.roots.has(absolute) &&
      ![...this.roots].some((root) => localSource(absolute, root, this.outputs))
    )
      return;
    clearTimeout(this.timer);
    this.timer = setTimeout(this.refresh, 75);
  };
}
