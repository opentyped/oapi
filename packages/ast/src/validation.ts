import path from 'node:path';
import ts from 'typescript';
import { diagnostics } from '~/diagnostic';
import { programDiagnostics } from '~/project';
import type { Project } from '~/project';

/** Checks real generated declarations in memory; builders retain incremental semantic diagnostics. */
export class ProjectValidation {
  private readonly snapshots = new Map<string, string>();
  private readonly checked = new Map<
    string,
    { input: ts.Program; snapshot: string; project: Project }
  >();
  private readonly builders = new Map<string, ts.EmitAndSemanticDiagnosticsBuilderProgram>();

  check(project: Project, declarations: ReadonlyMap<string, string> = new Map()): Project {
    if (!declarations.size) {
      diagnostics(
        programDiagnostics(project.program).filter(
          (item) => item.category === ts.DiagnosticCategory.Error,
        ),
      );
      return project;
    }
    const virtual = new Map([...declarations].map(([file, text]) => [path.resolve(file), text]));
    const snapshot = JSON.stringify([
      [...virtual].sort(([left], [right]) => left.localeCompare(right)),
      project.program
        .getSourceFiles()
        .map((source) => source.fileName)
        .sort(),
    ]);
    const checked = this.checked.get(project.configPath);
    if (checked?.input === project.program && checked.snapshot === snapshot) return checked.project;
    const previous = this.builders.get(project.configPath);
    const directories = new Set<string>();
    for (const file of virtual.keys()) {
      for (
        let directory = path.dirname(file);
        !directories.has(directory);
        directory = path.dirname(directory)
      ) {
        directories.add(directory);
        if (path.dirname(directory) === directory) break;
      }
    }
    const options = project.program.getCompilerOptions();
    const host = ts.createIncrementalCompilerHost(options);
    const readFile = host.readFile;
    host.readFile = (file): string | undefined => virtual.get(path.resolve(file)) ?? readFile(file);
    const fileExists = host.fileExists;
    host.fileExists = (file): boolean => virtual.has(path.resolve(file)) || fileExists(file);
    const directoryExists = host.directoryExists!;
    host.directoryExists = (directory): boolean =>
      directories.has(path.resolve(directory)) || directoryExists(directory);
    const getSourceFile = host.getSourceFile;
    host.getSourceFile = (file, languageVersion, onError, fresh): ts.SourceFile | undefined => {
      const source = project.program.getSourceFile(file);
      if (source && host.readFile(file) === source.text) {
        if (!('version' in source))
          Object.assign(source, { version: ts.sys.createHash?.(source.text) ?? source.text });
        return source;
      }
      const retained = previous?.getSourceFile(file);
      if (!fresh && retained && host.readFile(file) === retained.text) return retained;
      return getSourceFile(file, languageVersion, onError, fresh);
    };
    // A previously missing generated export may now exist without any consumer text changing.
    const resolutionsChanged = this.snapshots.get(project.configPath) !== snapshot;
    host.hasInvalidatedResolutions = (): boolean => resolutionsChanged;
    this.snapshots.set(project.configPath, snapshot);
    const builder = ts.createEmitAndSemanticDiagnosticsBuilderProgram(
      [...new Set([...project.program.getRootFileNames(), ...virtual.keys()])],
      options,
      host,
      previous,
      project.program.getConfigFileParsingDiagnostics(),
      project.program.getProjectReferences(),
    );
    this.builders.set(project.configPath, builder);
    const program = builder.getProgram();
    diagnostics(
      programDiagnostics(program, builder).filter(
        (item) => item.category === ts.DiagnosticCategory.Error,
      ),
    );
    const result = { ...project, program, checker: program.getTypeChecker() };
    this.checked.set(project.configPath, { input: project.program, snapshot, project: result });
    return result;
  }

  clear(): void {
    this.builders.clear();
    this.snapshots.clear();
    this.checked.clear();
  }
}
