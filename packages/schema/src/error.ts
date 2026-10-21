import type ts from 'typescript';

export class SchemaError extends Error {
  readonly file: string;
  readonly line: number;
  readonly column: number;

  constructor(message: string, node: ts.Node) {
    const source = node.getSourceFile();
    const location = source.getLineAndCharacterOfPosition(node.getStart(source));
    super(`${source.fileName}:${location.line + 1}:${location.character + 1}: ${message}`);
    this.name = 'SchemaError';
    this.file = source.fileName;
    this.line = location.line + 1;
    this.column = location.character + 1;
  }
}
