#!/usr/bin/env node
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import ts from 'typescript';
import { writeArtifacts } from '~/artifact';
import { defaultParsers } from '~/defaults';
import { generate } from '@typedapi/compiler';
import type { OutputOptions } from '@typedapi/compiler/config';

try {
  const { values } = parseArgs({
    options: { config: { type: 'string', short: 'c' }, help: { type: 'boolean', short: 'h' } },
    strict: true,
  });
  if (values.help) {
    console.log(
      'Usage: typedapi --config typedapi.config.mjs\nConfig exports a default OutputOptions object. Paths are relative to the config directory unless root is set.',
    );
  } else {
    const file = path.resolve(values.config ?? 'typedapi.config.mjs');
    const url = pathToFileURL(file).href;
    let loaded: unknown;
    if (/\.[cm]?ts$/.test(file)) {
      const { tsImport } = await import('tsx/esm/api');
      loaded = await tsImport(url, {
        parentURL: import.meta.url,
        tsconfig: ts.findConfigFile(path.dirname(file), ts.sys.fileExists) ?? false,
      });
    } else loaded = await import(url);
    const module = loaded as { default?: unknown };
    let config = module.default;
    if (
      config &&
      typeof config === 'object' &&
      !('info' in config) &&
      !('tsconfig' in config) &&
      'default' in config
    )
      config = config.default;
    if (!config || typeof config !== 'object')
      throw new Error('Config must export a default options object.');
    const value = config as OutputOptions;
    const options = {
      ...value,
      root: path.resolve(path.dirname(file), value.root ?? '.'),
    };
    const result = await writeArtifacts(options, generate(options, defaultParsers));
    result.warnings.forEach((warning) => console.warn(`[typedapi] ${warning}`));
    console.log(
      `Generated ${Object.keys(result.document.paths).length} paths, ${Object.keys(result.document.webhooks ?? {}).length} webhooks and ${Object.keys(result.schemas).length} JSON schemas in ${path.resolve(options.root, options.outDir ?? '.openapi')}`,
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
