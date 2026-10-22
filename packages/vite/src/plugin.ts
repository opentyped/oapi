import { DeclarationFile } from '~/declaration';
import { defaultParsers } from '~/defaults';
import { writeArtifacts } from '~/artifact';
import { SourceTransforms } from '~/transform';
import { GenerationError } from '@opentyped/oapi-openapi/diagnostic';
import path from 'node:path';
import os from 'node:os';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import type { Plugin, ResolvedConfig } from 'vite';
import type { Generation, OutputOptions } from '@opentyped/oapi-compiler/config';
import { GenerationCompiler } from '@opentyped/oapi-compiler/generate';
import type { SourceTransform } from '@opentyped/oapi-compiler/parser/parser';
import { serveDocuments } from '~/development';
import { SourceWatcher } from '~/watcher';

export type OpenApiPluginOptions = OutputOptions;

/** Independent type analysis: Vite's transpilation alone does not retain TypeScript types. */
export function openapi(options: OpenApiPluginOptions): Plugin {
  const compiler = new GenerationCompiler(defaultParsers);
  let config: ResolvedConfig;
  let declaration: DeclarationFile;
  let documentFile: string;
  let result: Generation | undefined;
  let transforms: SourceTransform[] = [];
  let cleanup: (() => Promise<void>) | undefined;
  let buildWatcher: SourceWatcher | undefined;
  let signalDirectory: string | undefined;
  let signal: string | undefined;
  let revision = 0;
  let watchFailure: Error | undefined;
  const regenerate = (): Generation => {
    const resolved = { ...options, root: path.resolve(config.root, options.root ?? '.') };
    const checked: SourceTransform[] = [];
    result = compiler.generate(
      resolved,
      (context) => checked.push(...context.transforms),
      declaration,
    );
    writeArtifacts(resolved, result);
    result.files = result.files.filter((file) => path.resolve(file) !== declaration.file);
    transforms = checked;
    result.warnings.forEach((warning) => config.logger.warn(`[oapi] ${warning}`));
    return result;
  };
  return {
    name: 'oapi:openapi',
    enforce: 'pre',
    config(user): { esbuild: { include: RegExp } } | undefined {
      // Vite 6 has no config-hook context; Vite 8's compiler already handles .cts.
      const major = Number.parseInt(this?.meta?.viteVersion ?? '6', 10);
      if (major < 8 && user.esbuild !== false && user.esbuild?.include === undefined)
        return { esbuild: { include: /\.(?:[cm]?ts|[jt]sx)$/ } };
    },
    configResolved(value): void {
      config = value;
      documentFile = path.resolve(config.root, options.root ?? '.', options.output.document);
      declaration = new DeclarationFile({
        ...options,
        root: path.resolve(config.root, options.root ?? '.'),
      });
    },
    configureServer(server): void {
      cleanup = serveDocuments(server, config, regenerate, [declaration.file, documentFile]);
    },
    buildStart(): void {
      if (config.command === 'serve') return;
      if (config.build.watch && !buildWatcher) {
        // Vite ignores node_modules even for explicit Rollup watch dependencies.
        signalDirectory = mkdtempSync(path.join(os.tmpdir(), 'oapi-watch-'));
        signal = path.join(signalDirectory, 'revision');
        writeFileSync(signal, String(revision));
        const notify = (): void => {
          writeFileSync(signal!, String(++revision));
        };
        buildWatcher = new SourceWatcher(config, notify, (error) => {
          watchFailure = error;
          config.logger.error(`[oapi] ${error.message}`);
          notify();
        });
        buildWatcher.excludeOutput(declaration.file);
        buildWatcher.excludeOutput(documentFile);
        buildWatcher.start();
      }
      if (signal) this.addWatchFile(signal);
      if (watchFailure) throw watchFailure;
      const watch = (files: string[], roots: string[] = []): void => {
        buildWatcher?.track(files, roots);
        files.forEach((file) => this.addWatchFile(file));
        // Discovery directories use the filtered watcher; raw directory watches include build output.
      };
      try {
        const generated = regenerate();
        watch(generated.files, generated.watchRoots);
      } catch (error) {
        if (error instanceof GenerationError) watch(error.files, error.watchRoots);
        throw error;
      }
    },
    transform(code, id): { code: string; map: string } | undefined {
      if (id.includes('?') || !/\.[cm]?tsx?$/.test(id)) return;
      if (id.split(path.sep).includes('node_modules')) return;
      if (
        transforms.some(
          (transform) => transform.source(id) !== undefined && transform.source(id) !== code,
        )
      )
        regenerate();
      return new SourceTransforms(transforms).apply(code, id);
    },
    async closeWatcher(): Promise<void> {
      compiler.clear();
      await buildWatcher?.close();
      if (signalDirectory) rmSync(signalDirectory, { recursive: true, force: true });
      buildWatcher = undefined;
      signalDirectory = undefined;
      signal = undefined;
      watchFailure = undefined;
    },
    async closeBundle(): Promise<void> {
      await cleanup?.();
      if (!config.build.watch) compiler.clear();
    },
  };
}
