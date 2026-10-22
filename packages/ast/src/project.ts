import path from 'node:path';
import ts from 'typescript';
import { AnalysisError } from '~/error';
import { diagnostics } from '~/diagnostic';
import { sourcePath } from '~/nodes';

export interface Project {
  program: ts.Program;
  checker: ts.TypeChecker;
  configPath: string;
  files: string[];
  directories: string[];
}

const builders = new WeakMap<ts.Program, ts.EmitAndSemanticDiagnosticsBuilderProgram>();

const checkedPrograms = new WeakMap<ts.Program, readonly ts.Diagnostic[]>();

/** Share complete diagnostics between AST consumers without rechecking an incremental program. */
export function programDiagnostics(
  program: ts.Program,
  builder?: ts.EmitAndSemanticDiagnosticsBuilderProgram,
): readonly ts.Diagnostic[] {
  builder ??= builders.get(program);
  const cached = checkedPrograms.get(program);
  if (cached) return cached;
  if (builder && builder.getProgram() !== program)
    throw new Error('Diagnostic builder must own the checked program.');
  const options = program.getCompilerOptions();
  const result = builder
    ? ts.sortAndDeduplicateDiagnostics([
        ...program.getConfigFileParsingDiagnostics(),
        ...builder.getOptionsDiagnostics(),
        ...builder.getGlobalDiagnostics(),
        ...builder.getSyntacticDiagnostics(),
        ...builder.getSemanticDiagnostics(),
        ...(options.declaration || options.composite ? builder.getDeclarationDiagnostics() : []),
      ])
    : ts.getPreEmitDiagnostics(program);
  checkedPrograms.set(program, result);
  return result;
}

interface CachedProject {
  options: string;
  sources: Map<string, ts.SourceFile>;
  metadata: Map<string, string | undefined>;
  realpaths: Map<string, string>;
  missing: Map<string, 'file' | 'directory'>;
  builder?: ts.EmitAndSemanticDiagnosticsBuilderProgram;
  failed: boolean;
  roots?: string;
  project?: Project;
}

/** One in-memory TypeScript builder per configuration; no application code is evaluated. */
export class ProjectCache {
  private readonly projects = new Map<string, CachedProject>();

  load = (root: string, tsconfig: string): Project => {
    const project = this.loadUnchecked(root, tsconfig);
    diagnostics(
      programDiagnostics(project.program).filter(
        (item) => item.category === ts.DiagnosticCategory.Error,
      ),
    );
    return project;
  };

  loadUnchecked = (root: string, tsconfig: string, excluded: readonly string[] = []): Project =>
    load(root, tsconfig, this.projects, excluded);

  clear(): void {
    this.projects.clear();
  }
}

/** Checks declaration provenance after resolving any import alias. */
export function isDefaultLibrarySymbol(project: Project, symbol: ts.Symbol | undefined): boolean {
  return !!symbol?.declarations?.some((declaration) =>
    project.program.isSourceFileDefaultLibrary(declaration.getSourceFile()),
  );
}

/** Loads the actual project configuration, including extends, imports and project references. */
export function loadProject(root: string, tsconfig: string): Project {
  const project = loadUncheckedProject(root, tsconfig);
  diagnostics(
    programDiagnostics(project.program).filter(
      (item) => item.category === ts.DiagnosticCategory.Error,
    ),
  );
  return project;
}

/** Constructs the real program before generated consumer declarations exist. */
export function loadUncheckedProject(
  root: string,
  tsconfig: string,
  excluded: readonly string[] = [],
): Project {
  return load(root, tsconfig, undefined, excluded);
}

function load(
  root: string,
  tsconfig: string,
  cache?: Map<string, CachedProject>,
  excluded: readonly string[] = [],
): Project {
  const configPath = path.resolve(root, tsconfig);
  const ignored = new Set(excluded.map((file) => path.resolve(file)));
  const cacheKey = JSON.stringify([configPath, [...ignored].sort()]);
  const files = new Set<string>([configPath]);
  const roots = new Set<string>();
  const contents = new Map<string, string | undefined>();
  const readCurrentFile = (file: string): string | undefined => {
    if (ignored.has(path.resolve(file))) return undefined;
    if (contents.has(file)) return contents.get(file);
    const text = ts.sys.readFile(file);
    contents.set(file, text);
    return text;
  };
  try {
    const readFile = (file: string): string | undefined => {
      files.add(path.resolve(file));
      return readCurrentFile(file);
    };
    const config = ts.readConfigFile(configPath, readFile);
    if (config.error) diagnostics([config.error]);
    const parsed = ts.parseJsonConfigFileContent(
      config.config,
      { ...ts.sys, readFile },
      path.dirname(configPath),
      { noEmit: true },
      configPath,
    );
    parsed.fileNames = parsed.fileNames.filter((file) => !ignored.has(path.resolve(file)));
    for (const directory of Object.keys(parsed.wildcardDirectories ?? {})) roots.add(directory);
    for (const file of parsed.fileNames) files.add(path.resolve(file));
    diagnostics(parsed.errors);
    const optionsKey = JSON.stringify([parsed.options, parsed.projectReferences]);
    let state = cache?.get(cacheKey);
    if (
      cache &&
      (!state ||
        state.options !== optionsKey ||
        [...state.realpaths].some(([file, target]) => ts.sys.realpath?.(file) !== target) ||
        [...state.metadata].some(([file, text]) => readCurrentFile(file) !== text))
    ) {
      state = {
        options: optionsKey,
        sources: new Map(),
        metadata: new Map(),
        realpaths: new Map(),
        missing: new Map(),
        failed: true,
      };
      cache.set(cacheKey, state);
    }
    const host = state
      ? ts.createIncrementalCompilerHost(parsed.options)
      : ts.createCompilerHost(parsed.options);
    const rootKey = JSON.stringify([
      parsed.fileNames,
      Object.keys(parsed.wildcardDirectories ?? {}),
      ts.getAutomaticTypeDirectiveNames(parsed.options, host),
    ]);
    let resolutionChanged = false;
    for (const [file, kind] of state?.missing ?? []) {
      if (!(kind === 'file' ? ts.sys.fileExists(file) : ts.sys.directoryExists(file))) continue;
      state!.missing.delete(file);
      resolutionChanged = true;
    }
    if (
      state?.project &&
      !resolutionChanged &&
      state.roots === rootKey &&
      [...state.sources].every(([file, source]) => readCurrentFile(file) === source.text)
    ) {
      return {
        ...state.project,
        files: [...new Set([...state.project.files, ...files])].sort(),
      };
    }
    const metadata = state?.metadata;
    for (const file of metadata?.keys() ?? []) files.add(file);
    if (state) {
      const retryResolutions = state.failed || resolutionChanged || state.roots !== rootKey;
      delete state.project;
      state.failed = true;
      const sources = state.sources;
      const realpaths = state.realpaths;
      const realpath = host.realpath;
      if (realpath)
        host.realpath = (file): string => {
          const target = realpath(file);
          realpaths.set(file, target);
          return target;
        };
      const getSourceFile = host.getSourceFile;
      host.getSourceFile = (file, version, onError, fresh): ts.SourceFile | undefined => {
        const previous = sources.get(file);
        if (!fresh && previous && host.readFile(file) === previous.text) return previous;
        const source = getSourceFile(file, version, onError, fresh);
        if (source) {
          sources.set(file, source);
          realpaths.set(file, sourcePath(source));
        } else sources.delete(file);
        return source;
      };
      // Failed module lookups must be retried when a missing import is installed or restored.
      host.hasInvalidatedResolutions = (): boolean => retryResolutions;
    }
    const readHostFile = host.readFile;
    host.readFile = (file): string | undefined => {
      if (ignored.has(path.resolve(file))) return undefined;
      const text = contents.has(file) ? contents.get(file) : readHostFile(file);
      contents.set(file, text);
      if (path.extname(file).toLowerCase() === '.json') {
        files.add(path.resolve(file));
        metadata?.set(file, text);
      }
      return text;
    };
    const fileExists = host.fileExists;
    host.fileExists = (file): boolean => {
      if (ignored.has(path.resolve(file))) return false;
      const exists = fileExists(file);
      const absolute = path.resolve(file);
      if (!exists) state?.missing.set(absolute, 'file');
      else state?.missing.delete(absolute);
      // Missing imports must remain watchable, including siblings outside the configured roots.
      if (path.basename(file) === 'package.json') {
        files.add(absolute);
        if (!exists) metadata?.set(file, undefined);
      }
      if (!exists && /\.[cm]?tsx?$/.test(absolute)) {
        files.add(absolute);
        if (!absolute.split(path.sep).includes('node_modules')) roots.add(path.dirname(absolute));
      }
      return exists;
    };
    const directoryExists = host.directoryExists;
    if (directoryExists)
      host.directoryExists = (directory): boolean => {
        const exists = directoryExists(directory);
        const absolute = path.resolve(directory);
        if (!exists) state?.missing.set(absolute, 'directory');
        else state?.missing.delete(absolute);
        if (!exists) roots.add(absolute);
        return exists;
      };
    const builder = state
      ? ts.createEmitAndSemanticDiagnosticsBuilderProgram(
          parsed.fileNames,
          parsed.options,
          host,
          state.builder,
          parsed.errors,
          parsed.projectReferences,
        )
      : undefined;
    if (state && builder) state.builder = builder;
    const program =
      builder?.getProgram() ??
      ts.createProgram({
        rootNames: parsed.fileNames,
        options: parsed.options,
        host,
        ...(parsed.projectReferences ? { projectReferences: parsed.projectReferences } : {}),
      });
    if (builder) builders.set(program, builder);
    for (const source of program.getSourceFiles()) {
      if (!program.isSourceFileDefaultLibrary(source)) files.add(path.resolve(source.fileName));
    }
    if (state) {
      const active = new Set(program.getSourceFiles().map((source) => source.fileName));
      for (const file of state.sources.keys()) if (!active.has(file)) state.sources.delete(file);
    }
    const references = [...(program.getResolvedProjectReferences() ?? [])];
    const checked = new Set<ts.ResolvedProjectReference>();
    while (references.length) {
      const reference = references.pop();
      if (!reference || checked.has(reference)) continue;
      checked.add(reference);
      diagnostics(reference.commandLine.errors);
      references.push(...(reference.references ?? []));
    }
    if (state) state.failed = false;
    const project = {
      program,
      checker: program.getTypeChecker(),
      configPath,
      files: [...files].sort(),
      directories: [...roots].sort(),
    };
    if (state) {
      state.roots = rootKey;
      state.project = project;
    }
    return project;
  } catch (error) {
    if (error instanceof AnalysisError) error.withSources(files, roots);
    throw error;
  } finally {
    contents.clear();
  }
}
