import ts from 'typescript';

const sources = new WeakMap<ts.SourceFile, Map<string, readonly ts.Node[]>>();

/** Immutable source files retain their syntax indexes across incremental compiler programs. */
export function sourceNodes(
  source: ts.SourceFile,
  kinds: readonly ts.SyntaxKind[],
): readonly ts.Node[] {
  const key = kinds.join(',');
  let indexes = sources.get(source);
  const cached = indexes?.get(key);
  if (cached) return cached;
  const wanted = new Set(kinds);
  const nodes: ts.Node[] = [];
  const visit = (node: ts.Node): void => {
    if (wanted.has(node.kind)) nodes.push(node);
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (!indexes) sources.set(source, (indexes = new Map()));
  indexes.set(key, nodes);
  return nodes;
}

const physicalPaths = new WeakMap<ts.SourceFile, string>();

/** A source file's physical identity belongs to its immutable compiler snapshot. */
export function sourcePath(source: ts.SourceFile): string {
  let file = physicalPaths.get(source);
  if (file === undefined) {
    file = ts.sys.realpath?.(source.fileName) ?? source.fileName;
    physicalPaths.set(source, file);
  }
  return file;
}

/** Lexical declaration and property names, without source offsets or sibling counters. */
export function nodeNames(node: ts.Node): string[] {
  const names: string[] = [];
  for (
    let current: ts.Node | undefined = node;
    current && !ts.isSourceFile(current);
    current = current.parent
  ) {
    const name = 'name' in current ? (current.name as ts.DeclarationName | undefined) : undefined;
    if (!name) continue;
    if (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name))
      names.unshift(name.text);
    else if (
      ts.isComputedPropertyName(name) &&
      (ts.isStringLiteralLike(name.expression) || ts.isNumericLiteral(name.expression))
    )
      names.unshift(name.expression.text);
  }
  return names;
}
