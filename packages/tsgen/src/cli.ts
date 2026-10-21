#!/usr/bin/env node
import { readFile, writeFile, mkdir, mkdtemp, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { generateDeclarations } from '~/index';

try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      output: { type: 'string', short: 'o', default: '.openapi/openapi.d.ts' },
      prefix: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help)
    process.stdout.write(
      'typedapi-tsgen <openapi.json> [-o .openapi/openapi.d.ts] [--prefix openapi]\n',
    );
  else {
    if (positionals.length !== 1) throw new Error('Provide one OpenAPI JSON file.');
    const document: unknown = JSON.parse(await readFile(positionals[0]!, 'utf8'));
    if (!document || typeof document !== 'object' || Array.isArray(document))
      throw new Error('The OpenAPI document must be an object.');
    const definitions = generateDeclarations(
      document,
      values.prefix === undefined ? {} : { prefix: values.prefix },
    );
    if (values.output !== '-') {
      await mkdir(path.dirname(values.output), { recursive: true });
      const staging = await mkdtemp(path.join(path.dirname(values.output), '.typedapi-tsgen-'));
      try {
        const file = path.join(staging, 'openapi.d.ts');
        await writeFile(file, definitions);
        await rename(file, values.output);
      } finally {
        await rm(staging, { recursive: true, force: true });
      }
    } else process.stdout.write(definitions);
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
