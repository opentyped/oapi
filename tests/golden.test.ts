import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { GenerationCompiler } from '@typedapi/compiler';
import { defaultParsers } from '@typedapi/vite';
import { ExpressParser } from '@typedapi/express/parser';
import type { GenerateOptions } from '@typedapi/compiler';
import type { OpenApiDocument } from '@typedapi/openapi';
import { generateDefinitions, generateDeclarations } from '@typedapi/tsgen';
import type { DefinitionOptions, DeclarationOptions } from '@typedapi/tsgen';
import ts from 'typescript';

const directory = fileURLToPath(new URL('.', import.meta.url));
const cases = (await readdir(directory, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && /^\d{3}_/.test(entry.name))
  .map((entry) => entry.name)
  .sort();
assert.ok(cases.length, 'Numbered golden fixtures must exist.');

for (const name of cases)
  test(`golden ${name}`, async (t) => {
    const fixture = path.join(directory, name);
    const files = await readdir(fixture);
    assert.ok(files.includes('test.ts'), `${name} requires test.ts`);
    assert.ok(files.includes('openapi.json'), `${name} requires openapi.json`);
    const root = await mkdtemp(path.join(directory, '.contract-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    await cp(fixture, root, { recursive: true });
    await writeFile(
      path.join(root, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          strict: true,
          exactOptionalPropertyTypes: true,
          skipLibCheck: true,
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          types: [],
        },
        files: ['test.ts'],
      }),
    );
    const extra = files.includes('options.json')
      ? (JSON.parse(await readFile(path.join(fixture, 'options.json'), 'utf8')) as Pick<
          GenerateOptions,
          | 'openapi'
          | '$self'
          | 'types'
          | 'typeMappings'
          | 'namespaces'
          | 'security'
          | 'securitySchemes'
          | 'include'
          | 'nest'
          | 'documents'
          | 'servers'
          | 'tags'
          | 'headers'
          | 'info'
        >)
      : {};
    const options: GenerateOptions = {
      info: { title: 'Golden fixtures', version: '1.0.0' },
      ...extra,
      root,
      tsconfig: 'tsconfig.json',
      parsers: [...defaultParsers(), new ExpressParser()],
    };
    const expected = JSON.parse(
      await readFile(path.join(fixture, 'openapi.json'), 'utf8'),
    ) as OpenApiDocument;
    const compiler = new GenerationCompiler(defaultParsers);
    t.after(() => compiler.clear());
    const result = compiler.generate(options);
    assert.deepEqual(
      JSON.parse(JSON.stringify(result.document)),
      expected,
      `${name}: generated OpenAPI differs from the hand-authored contract`,
    );
    if (files.includes('steps')) {
      assert.deepEqual(compiler.generate(options).document, result.document);
      for (const step of (await readdir(path.join(fixture, 'steps'))).sort()) {
        const source = path.join(fixture, 'steps', step);
        await cp(source, root, { recursive: true });
        const document = JSON.parse(await readFile(path.join(source, 'openapi.json'), 'utf8'));
        assert.deepEqual(
          JSON.parse(JSON.stringify(compiler.generate(options).document)),
          document,
          `${name}/${step}: incremental generation differs from the authored contract`,
        );
      }
    }
    if (files.includes('schema.d.ts') || files.includes('openapi.d.ts')) {
      const definitionOptions = files.includes('tsgen.json')
        ? (JSON.parse(
            await readFile(path.join(fixture, 'tsgen.json'), 'utf8'),
          ) as DefinitionOptions)
        : {};
      const ambient = files.includes('openapi.d.ts');
      const file = ambient ? 'openapi.d.ts' : 'schema.d.ts';
      const declarationOptions = files.includes('declarations.json')
        ? (JSON.parse(
            await readFile(path.join(fixture, 'declarations.json'), 'utf8'),
          ) as DeclarationOptions)
        : {};
      const definitions = ambient
        ? generateDeclarations(result.document, {
            ...declarationOptions,
            models: result.models,
          })
        : generateDefinitions(result.document, definitionOptions);
      assert.equal(definitions, await readFile(path.join(fixture, file), 'utf8'));
      await writeFile(path.join(root, file), definitions);
      const program = ts.createProgram(
        [
          path.join(root, file),
          ...(files.includes('usage.ts') ? [path.join(root, 'usage.ts')] : []),
        ],
        {
          strict: true,
          noEmit: true,
          skipLibCheck: false,
          types: [],
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.NodeNext,
          moduleResolution: ts.ModuleResolutionKind.NodeNext,
        },
      );
      const diagnostics = ts.getPreEmitDiagnostics(program);
      assert.equal(
        diagnostics.length,
        0,
        ts.formatDiagnosticsWithColorAndContext(diagnostics, {
          getCurrentDirectory: () => root,
          getCanonicalFileName: (file) => file,
          getNewLine: () => '\n',
        }),
      );
    }
  });
