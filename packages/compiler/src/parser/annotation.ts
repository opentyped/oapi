import { tagsOf, documentationOf } from '@typedapi/ast/jsdoc';
import { operationAnnotations } from '@typedapi/openapi/document/definition';
import ts from 'typescript';
import type { Project } from '@typedapi/ast/project';
import { fail } from '@typedapi/ast/diagnostic';

const singular = new Set([
  ...operationAnnotations,
  'http',
  'schema',
  'schemaName',
  'rename',
  'renameAll',
  'inline',
  'hidden',
  'ref',
  'asType',
  'jsonSchema',
  'xml',
  'response',
  'description',
  'deprecated',
  'extensions',
]);

/** Reads a declaration's annotations once and rejects ambiguous duplicate metadata. */
export function annotationsOf(node: ts.Node): ReadonlyMap<string, string> {
  const annotations = new Map<string, string>();
  for (const { name, value } of tagsOf(node)) {
    if (name === 'namespace')
      fail(node, '@namespace is unsupported; configure namespaces with source-file globs instead.');
    if (singular.has(name) && annotations.has(name)) fail(node, `Duplicate @${name} annotation.`);
    annotations.set(name, value);
  }
  const documentation = documentationOf(node);
  if (documentation) {
    const [summary, ...remaining] = documentation.split(/\r?\n/);
    if (!annotations.has('summary')) annotations.set('summary', summary!.trim());
    if (!annotations.has('description'))
      annotations.set('description', remaining.join('\n').trim());
  }
  return annotations;
}

interface AnnotatedNode {
  node: ts.Node;
  annotations?: ReadonlyMap<string, string>;
}
const sources = new WeakMap<ts.SourceFile, readonly AnnotatedNode[]>();

/** Revisit annotation candidates only; a changed source file receives a fresh syntax index. */
export function visitAnnotations(
  project: Project,
  visitor: (node: ts.Node, annotations: ReadonlyMap<string, string>) => boolean | void,
): void {
  for (const source of project.program.getSourceFiles()) {
    if (source.isDeclarationFile || project.program.isSourceFileFromExternalLibrary(source))
      continue;
    let nodes = sources.get(source);
    if (!nodes) {
      const found: AnnotatedNode[] = [];
      const visit = (node: ts.Node): void => {
        if (ts.getJSDocTags(node).length) found.push({ node });
        ts.forEachChild(node, visit);
      };
      for (const statement of source.statements) visit(statement);
      sources.set(source, (nodes = found));
    }
    let end = -1;
    for (const entry of nodes) {
      const { node } = entry;
      if (node.pos < end) continue;
      const annotations = (entry.annotations ??= annotationsOf(node));
      if (visitor(node, annotations) === false) end = node.end;
    }
  }
}
