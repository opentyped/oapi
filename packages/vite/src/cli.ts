#!/usr/bin/env node
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import ts from 'typescript';
import { DeclarationFile } from '~/declaration';
import { writeArtifacts } from '~/artifact';
import { defaultParsers } from '~/defaults';
import { generate } from '@opentyped/compiler';
import type { OutputOptions } from '@opentyped/compiler/config';

try {
  const { values } = parseArgs({
    options: { config: { type: 'string', short: 'c' }, help: { type: 'boolean', short: 'h' } },
    strict: true,
  });
  if (values.help) {
    console.log(
      'Usage: oapi --config oapi.config.mjs\nConfig exports a default OutputOptions object. Paths are relative to the config directory unless root is set.',
    );
  } else {
    const file = path.resolve(values.config ?? 'oapi.config.mjs');
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
    const declaration = new DeclarationFile(options);
    const result = writeArtifacts(options, generate(options, defaultParsers, declaration));
    result.warnings.forEach((warning) => console.warn(`[oapi] ${warning}`));
    console.log(
      `Generated ${Object.keys(result.document.paths).length} paths, ${Object.keys(result.document.webhooks ?? {}).length} webhooks to ${options.output.document} and ${options.output.declarations}`,
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
