import ts from 'typescript';
import { AnalysisError } from '~/error';
import type { Source } from '~/error';

export function sourceOf(node: ts.Node): Source {
  const source = node.getSourceFile();
  const { line, character } = source.getLineAndCharacterOfPosition(node.getStart(source));
  const location = `${source.fileName}:${line + 1}:${character + 1}`;
  return {
    location,
    fail(message): never {
      throw new AnalysisError(`${location}: ${message}`);
    },
  };
}

export function fail(node: ts.Node, message: string): never {
  return sourceOf(node).fail(message);
}

export function diagnostics(errors: readonly ts.Diagnostic[]): void {
  if (!errors.length) return;
  throw new AnalysisError(
    ts.formatDiagnosticsWithColorAndContext(errors, {
      getCurrentDirectory: ts.sys.getCurrentDirectory,
      getCanonicalFileName: (name) => name,
      getNewLine: () => '\n',
    }),
  );
}
