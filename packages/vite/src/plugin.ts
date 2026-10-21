import { DeclarationFile } from '~/declaration';
import { defaultParsers } from '~/defaults';
import { ArtifactManifest } from '~/artifact';
import { SourceTransforms } from '~/transform';
import { GenerationError } from '@typedapi/openapi/diagnostic';
import path from 'node:path';
import os from 'node:os';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import type { Plugin, ResolvedConfig } from 'vite';
import type { GenerateOptions, Generation, OutputOptions } from '@typedapi/compiler/config';
import { GenerationCompiler } from '@typedapi/compiler/generate';
import type { SourceTransform } from '@typedapi/compiler/parser/parser';
import { stableJson } from '@typedapi/openapi/json';
import { serveDocuments } from '~/development';
import { SourceWatcher } from '~/watcher';

export interface OpenApiPluginOptions extends GenerateOptions {
  /** Asset directory within Vite's outDir; dev URL uses the same path. Default: api. */
  assetDir?: string;
  declarations?: NonNullable<OutputOptions['declarations']>;
}

/** Independent type analysis: Vite's transpilation alone does not retain TypeScript types. */
export function openapi(options: OpenApiPluginOptions): Plugin {
  const compiler = new GenerationCompiler(defaultParsers);
  const directory = options.assetDir ?? 'api';
  if (!/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(directory))
    throw new Error('assetDir must be a relative directory of simple path segments.');
  let config: ResolvedConfig;
  let declaration: DeclarationFile;
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
    result = compiler.generate(resolved, (context) => checked.push(...context.transforms));
    declaration.write(result);
    result.files = result.files.filter((file) => path.resolve(file) !== declaration.file);
    transforms = checked;
    result.warnings.forEach((warning) => config.logger.warn(`[typedapi] ${warning}`));
    return result;
  };
  return {
    name: 'typedapi:openapi',
    enforce: 'pre',
    config(user): { esbuild: { include: RegExp } } | undefined {
      // Vite 6 has no config-hook context; Vite 8's compiler already handles .cts.
      const major = Number.parseInt(this?.meta?.viteVersion ?? '6', 10);
      if (major < 8 && user.esbuild !== false && user.esbuild?.include === undefined)
        return { esbuild: { include: /\.(?:[cm]?ts|[jt]sx)$/ } };
    },
    configResolved(value): void {
      config = value;
      declaration = new DeclarationFile({
        ...options,
        root: path.resolve(config.root, options.root ?? '.'),
      });
    },
    configureServer(server): void {
      cleanup = serveDocuments(server, config, directory, regenerate, [declaration.directory]);
    },
    buildStart(): void {
      if (config.command === 'serve') return;
      if (config.build.watch && !buildWatcher) {
        // Vite ignores node_modules even for explicit Rollup watch dependencies.
        signalDirectory = mkdtempSync(path.join(os.tmpdir(), 'typedapi-watch-'));
        signal = path.join(signalDirectory, 'revision');
        writeFileSync(signal, String(revision));
        const notify = (): void => {
          writeFileSync(signal!, String(++revision));
        };
        buildWatcher = new SourceWatcher(config, notify, (error) => {
          watchFailure = error;
          config.logger.error(`[typedapi] ${error.message}`);
          notify();
        });
        buildWatcher.excludeOutput(declaration.directory);
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
    generateBundle(output): void {
      buildWatcher?.excludeOutput(
        path.resolve(output.dir ?? path.resolve(config.root, config.build.outDir)),
      );
      const value = result ?? regenerate();
      this.emitFile({
        type: 'asset',
        fileName: `${directory}/openapi.json`,
        source: stableJson(value.document),
      });
      for (const [name, schema] of Object.entries(value.schemas))
        this.emitFile({
          type: 'asset',
          fileName: `${directory}/schemas/${name}.json`,
          source: stableJson(schema),
        });
    },
    async writeBundle(output, bundle): Promise<void> {
      if (!result || !Object.hasOwn(bundle, `${directory}/openapi.json`)) return;
      const root = path.resolve(output.dir ?? path.resolve(config.root, config.build.outDir));
      const manifest = await ArtifactManifest.read(path.join(root, directory));
      await manifest.commit([
        'openapi.json',
        ...Object.keys(result.schemas)
          .map((name) => `schemas/${name}.json`)
          .filter((name) => Object.hasOwn(bundle, `${directory}/${name}`)),
      ]);
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
