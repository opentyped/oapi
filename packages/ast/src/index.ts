export { AnalysisError } from '~/error';
export type { Source } from '~/error';
export { loadProject, ProjectCache, programDiagnostics, isDefaultLibrarySymbol } from '~/project';
export type { Project } from '~/project';
export { sourceOf, fail, diagnostics } from '~/diagnostic';
export { tagsOf, documentationOf } from '~/jsdoc';
export { ConstantJson } from '~/json';
export type { JsonValue } from '~/json';
export { ConstantString, constantDeclaration, constantProperty, constantObject } from '~/constant';
export { TypeProjection } from '~/projection';
export { walkProject } from '~/walk';
export {
  unwrapExpression,
  unwrapType,
  unwrapNoInfer,
  typeNodeOf,
  propertiesOf,
  tupleElementsOf,
  builtInName,
  indexedMapping,
  identityMapping,
  mutabilitySource,
  aliasTarget,
} from '~/navigation';
export type { ResolvedProperty } from '~/navigation';
export { disjointTemplates, escapePattern, templatePattern } from '~/pattern';

export { sourceNodes, sourcePath, nodeNames } from '~/nodes';
