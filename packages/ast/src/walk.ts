import ts from 'typescript';
import type { Project } from '~/project';

/** Walks application source nodes; false skips the current node's descendants. */
export function walkProject(project: Project, visitor: (node: ts.Node) => boolean | void): void {
  const visit = (node: ts.Node): void => {
    if (visitor(node) !== false) ts.forEachChild(node, visit);
  };
  for (const source of project.program.getSourceFiles())
    if (!source.isDeclarationFile && !project.program.isSourceFileFromExternalLibrary(source))
      for (const statement of source.statements) visit(statement);
}
