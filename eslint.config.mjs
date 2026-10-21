import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import prettier from 'eslint-config-prettier';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// Include type imports and re-exports: layer rules alone cannot prevent cycles within a domain.
function assertAcyclicImports() {
  const root = fileURLToPath(new URL('.', import.meta.url));
  const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
  if (config.error)
    throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  const { options } = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  const files = new Set();
  const workspaceOptions = new Map();
  const owners = new Map();
  const manifests = new Map();
  const packageNames = new Map();
  const dependencies = {
    ast: [],
    fetch: [],
    schema: ['ast', 'openapi'],
    openapi: [],
    compiler: ['ast', 'openapi', 'schema'],
    express: ['ast', 'openapi', 'compiler'],
    tsgen: ['openapi'],
    vite: ['ast', 'openapi', 'compiler', 'tsgen'],
  };
  const permitted = (owner, dependency) =>
    owner === 'main' || owner === dependency || dependencies[owner]?.includes(dependency);
  for (const entry of readdirSync(path.join(root, 'packages'), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const directory = path.join(root, 'packages', entry.name);
    const manifest = JSON.parse(ts.sys.readFile(path.join(directory, 'package.json')));
    manifests.set(entry.name, manifest);
    packageNames.set(manifest.name, entry.name);
    const config = ts.readConfigFile(path.join(directory, 'tsconfig.json'), ts.sys.readFile);
    if (config.error)
      throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, directory);
    for (const file of ts.sys.readDirectory(path.join(directory, 'src'), ['.ts'])) {
      files.add(file);
      workspaceOptions.set(file, parsed.options);
      owners.set(file, entry.name);
    }
  }
  for (const [owner, manifest] of manifests) {
    for (const name of Object.keys({
      ...manifest.dependencies,
      ...manifest.devDependencies,
      ...manifest.peerDependencies,
    })) {
      const dependency = packageNames.get(name);
      if (dependency && !permitted(owner, dependency))
        throw new Error(`Forbidden package dependency: ${owner} -> ${dependency}`);
    }
  }
  function sourceExport(specifier) {
    const name = [...packageNames.keys()].find(
      (name) => specifier === name || specifier.startsWith(name + '/'),
    );
    if (!name) return undefined;
    const owner = packageNames.get(name);
    const key = '.' + specifier.slice(name.length);
    const entries = manifests.get(owner).exports;
    let entry = entries[key];
    if (!entry) {
      for (const [pattern, value] of Object.entries(entries)) {
        if (!pattern.includes('*')) continue;
        const [prefix, suffix] = pattern.split('*');
        if (!key.startsWith(prefix) || !key.endsWith(suffix)) continue;
        const match = key.slice(prefix.length, suffix ? -suffix.length : undefined);
        const target = value.types ?? value.import;
        return path.resolve(
          owner === 'main' ? root : path.join(root, 'packages', owner),
          target
            .replace('*', match)
            .replace('./dist/', './src/')
            .replace(/\.d\.ts$/, '.ts'),
        );
      }
      return undefined;
    }
    return path.resolve(
      owner === 'main' ? root : path.join(root, 'packages', owner),
      (entry.types ?? entry.import).replace('./dist/', './src/').replace(/\.d\.ts$/, '.ts'),
    );
  }
  const cache = ts.createModuleResolutionCache(root, (file) => file, options);
  const edges = new Map();
  for (const file of files) {
    const source = ts.createSourceFile(file, ts.sys.readFile(file), ts.ScriptTarget.Latest, true);
    const imports = [];
    const collect = (node) => {
      let name;
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) name = node.moduleSpecifier;
      else if (
        ts.isImportEqualsDeclaration(node) &&
        ts.isExternalModuleReference(node.moduleReference)
      )
        name = node.moduleReference.expression;
      else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument))
        name = node.argument.literal;
      else if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
      )
        name = node.arguments[0];
      if (name && ts.isStringLiteralLike(name)) record(name);
      ts.forEachChild(node, collect);
    };
    const record = (name) => {
      if (name.text.startsWith('.'))
        throw new Error(`Use extensionless ~/ aliases in ${file}: ${name.text}`);
      if (
        !name.text.startsWith('~/') &&
        ![...packageNames.keys()].some(
          (key) => name.text === key || name.text.startsWith(key + '/'),
        )
      )
        return;
      if (name.text.split('/').some((part) => !part || part === '.' || part === '..'))
        throw new Error(`Use a canonical internal import in ${file}: ${name.text}`);
      const target = ts.resolveModuleName(
        name.text,
        file,
        workspaceOptions.get(file) ?? options,
        ts.sys,
        cache,
      ).resolvedModule;
      const resolved = target?.resolvedFileName;
      const source = resolved?.replace('/dist/', '/src/').replace(/\.d\.ts$/, '.ts');
      const dependency = sourceExport(name.text) ?? (files.has(resolved) ? resolved : source);
      if (!dependency || !files.has(dependency))
        throw new Error(`Unresolved internal import in ${file}: ${name.text}`);
      if (!permitted(owners.get(file), owners.get(dependency)))
        throw new Error(`Forbidden dependency in ${file}: ${name.text}`);
      imports.push(dependency);
    };
    collect(source);
    edges.set(file, imports);
  }
  const visited = new Set();
  function visit(file, active = []) {
    const cycle = active.indexOf(file);
    if (cycle >= 0)
      throw new Error(
        'Circular internal imports: ' +
          [...active.slice(cycle), file].map((name) => path.relative(root, name)).join(' -> '),
      );
    if (visited.has(file)) return;
    for (const target of edges.get(file)) visit(target, [...active, file]);
    visited.add(file);
  }
  for (const file of files) visit(file);
}
assertAcyclicImports();

const parserDomains = readdirSync(new URL('./packages/compiler/src/parser/', import.meta.url), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const modulePatterns = (patterns) => patterns;

const noCompiler = {
  paths: ['typescript', 'ts-json-schema-generator', 'vite', 'express'],
  patterns: modulePatterns([
    'typedapi',
    'typedapi/*',
    '@typedapi/compiler*',
    '@typedapi/express*',
    '@typedapi/vite*',
    '@typedapi/tsgen*',
    '@typedapi/ast',
    '@typedapi/ast/*',
  ]),
};

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'packages/*/dist/**',
      'node_modules/**',
      'examples/**/dist/**',
      'examples/**/generated/**',
      '**/.openapi/**',
      'tests/.golden-*/**',
      'tests/.contract-*/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.node, ...globals.browser } } },
  {
    files: ['packages/tsgen/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '@typedapi/ast*',
            '@typedapi/compiler*',
            '@typedapi/express*',
            '@typedapi/vite*',
            '@typedapi/tsgen*',
            'typedapi',
            'typedapi/*',
            'vite',
            'vite/*',
            'express',
            'express/*',
            './*',
            '../*',
          ],
        },
      ],
    },
  },
  {
    files: [
      'src/**/*.ts',
      'packages/ast/src/**/*.ts',
      'packages/fetch/src/**/*.ts',
      'packages/schema/src/**/*.ts',
      'packages/openapi/src/**/*.ts',
      'packages/compiler/src/**/*.ts',
      'packages/express/src/**/*.ts',
      'packages/vite/src/**/*.ts',
      'packages/tsgen/src/**/*.ts',
    ],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      'max-depth': ['error', 4],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportSpecifier[importKind="type"]',
          message: 'Use a separate import type declaration.',
        },
        {
          selector:
            ':matches(ImportDeclaration, ExportNamedDeclaration, ExportAllDeclaration, ImportExpression)[source.value=/^\\./]',
          message: 'Use extensionless ~/ aliases so dependency boundaries cannot be bypassed.',
        },
        {
          selector:
            ':matches(ImportDeclaration, ExportNamedDeclaration, ExportAllDeclaration, ImportExpression)[source.value=/^~.+\\.[cm]?[jt]sx?$/]',
          message: 'Internal ~/ imports must be extensionless.',
        },
        {
          selector: 'ImportExpression[source.value=/^~/]',
          message: 'Use static internal imports so dependency boundaries are checked.',
        },
        {
          selector: 'TSExternalModuleReference[expression.value=/^~/]',
          message: 'Use static ESM internal imports so dependency boundaries are checked.',
        },
        {
          selector: 'CallExpression[callee.name="require"][arguments.0.value=/^~/]',
          message: 'Use static ESM internal imports so dependency boundaries are checked.',
        },
        {
          selector:
            ':matches(ImportExpression[source.quasis.0.value.cooked=/^~/], CallExpression[callee.name="require"][arguments.0.quasis.0.value.cooked=/^~/])',
          message: 'Use static ESM internal imports so dependency boundaries are checked.',
        },
      ],
    },
  },
  {
    files: ['packages/ast/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: modulePatterns([
            '@typedapi/*',
            'typedapi',
            'typedapi/*',
            'vite',
            'vite/*',
            'express',
            'express/*',
          ]),
        },
      ],
    },
  },
  {
    files: ['packages/openapi/src/schema/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: noCompiler.paths,
          patterns: modulePatterns([...noCompiler.patterns, '~/document/*']),
        },
      ],
    },
  },
  {
    files: ['packages/openapi/src/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', noCompiler] },
  },
  {
    files: ['packages/compiler/src/parser/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: modulePatterns(['~/parser/*/**', '~/session', '~/generate', '~/config']),
        },
      ],
    },
  },
  ...parserDomains.map((domain) => ({
    files: [`packages/compiler/src/parser/${domain}/**/*.ts`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: modulePatterns([
            ...parserDomains
              .filter((other) => other !== domain)
              .map((other) => `~/parser/${other}/**`),
          ]),
        },
      ],
    },
  })),
  {
    files: ['packages/express/src/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: ['typescript', 'ts-json-schema-generator'],
          patterns: modulePatterns([
            '@typedapi/ast',
            '@typedapi/ast/*',
            '@typedapi/compiler',
            '@typedapi/compiler/*',
            '~/parser/*',
          ]),
        },
      ],
    },
  },
  {
    files: ['packages/compiler/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: modulePatterns([]),
        },
      ],
    },
  },
  {
    files: ['packages/vite/src/**/*.ts'],
    ignores: ['packages/vite/src/defaults.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: modulePatterns(['@typedapi/compiler/parser/*/**', '@typedapi/express*']) },
      ],
    },
  },
  {
    files: ['examples/**/*.{ts,mjs}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(?:\\.\\./)+src(?:/|$)|^~/',
              message: 'Examples must use public package entrypoints.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['tests/**/test.ts'],
    rules: {
      '@typescript-eslint/no-require-imports': ['error', { allowAsImport: true }],
    },
  },
  prettier,
);
