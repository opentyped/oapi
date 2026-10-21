import { DEFAULT_OPENAPI } from '@typedapi/openapi/document/definition';
import { ParserContext } from '~/parser/context';
import { ParserPipeline } from '~/parser/pipeline';
import type { ParserFactory } from '~/parser/parser';
import { DocumentValidation } from '@typedapi/openapi/document/validation';
import { SchemaIdentity } from '~/parser/schema/identity';
import type { NamespaceScope } from '~/parser/schema/identity';
import { modifyDocument } from '@typedapi/openapi/document/modifier';
import { loadProject } from '@typedapi/ast/project';
import { AnalysisError } from '@typedapi/ast/error';
import path from 'node:path';
import { stableJson, validateJson } from '@typedapi/openapi/json';
import { explicitSchema } from '@typedapi/openapi/schema/validation';
import { componentName } from '@typedapi/openapi/schema/reference';
import { mergeDocuments } from '@typedapi/openapi/document/merge';
import type { Project } from '@typedapi/ast/project';
import type { GenerateOptions, Generation } from '~/config';
import type { Schema, SchemaExport } from '@typedapi/openapi/schema/definition';
import { GenerationError } from '@typedapi/openapi/diagnostic';
import { packageInfo } from '~/package';
import type { ParserOptions } from '~/parser/options';

function validateOptions(options: GenerateOptions): void {
  if (options.openapi !== undefined && !['3.1.0', '3.2.0'].includes(options.openapi))
    throw new GenerationError('openapi must be 3.1.0 or 3.2.0.');
  if (typeof options.tsconfig !== 'string' || !options.tsconfig.trim())
    throw new GenerationError('tsconfig is required.');
  if (options.documents !== undefined && !Array.isArray(options.documents))
    throw new GenerationError('documents must be an array.');
  if (
    options.info !== undefined &&
    (!options.info || typeof options.info !== 'object' || Array.isArray(options.info))
  )
    throw new GenerationError('info must be an object.');
  for (const key of ['title', 'version'] as const) {
    const value = options.info?.[key];
    if (value !== undefined && (typeof value !== 'string' || !value.trim()))
      throw new GenerationError(`info.${key} must be a nonempty string.`);
  }
  for (const kind of ['any', 'unknown'] as const) {
    const value = options.types?.[kind];
    if (value !== undefined && value !== 'error' && value !== 'allow')
      throw new GenerationError(`Invalid types.${kind} policy.`);
  }
}

/** Owns the project graph, checked compiler programs, and generation dependency lifecycle. */
export class GenerationSession {
  private readonly active = new Set<GenerateOptions>();
  private readonly projects = new Map<string, Project>();
  private count = 0;
  private readonly namespaceScopes: NamespaceScope[] = [];
  private identities: SchemaIdentity | undefined;
  private readonly files = new Set<string>();
  private readonly roots = new Set<string>();
  private readonly metadataFiles = new Set<string>();
  constructor(
    private readonly defaultParsers: ParserFactory,
    private readonly onProject?: (project: Project) => void,
    private readonly onContext?: (context: ParserContext) => void,
    private readonly load: typeof loadProject = loadProject,
  ) {}

  run(input: GenerateOptions, supplied?: Project, baseRoot = process.cwd()): Generation {
    if (this.active.has(input) || this.active.size >= 100)
      throw new GenerationError('Circular or excessive project document composition.');
    if (++this.count > 1000)
      throw new GenerationError('Document composition exceeds 1000 generations.');
    validateOptions(input);
    this.active.add(input);
    try {
      const options = {
        ...input,
        openapi: input.openapi ?? DEFAULT_OPENAPI,
        root: path.resolve(baseRoot, input.root ?? '.'),
      };
      const info = packageInfo(options.root, options.info, this.metadataFiles);
      for (const file of this.metadataFiles) this.files.add(file);
      if (
        typeof info.title !== 'string' ||
        !info.title.trim() ||
        typeof info.version !== 'string' ||
        !info.version.trim()
      )
        throw new GenerationError(
          'info.title and info.version are required; supply them in info or package.json.',
        );
      const project = this.project(options.root, options.tsconfig, supplied);
      if (!this.identities) {
        this.prepare(input, baseRoot, new Set(), { count: 0 });
        this.identities = new SchemaIdentity(project, this.projects.values(), this.namespaceScopes);
      }
      return this.compile({ ...options, info }, project);
    } catch (error) {
      const failure =
        error instanceof AnalysisError
          ? new GenerationError(error.message, { cause: error }).withSources(
              error.files,
              error.watchRoots,
            )
          : error;
      if (failure instanceof GenerationError)
        failure.withSources([...this.files, ...this.metadataFiles], this.roots);
      throw failure;
    } finally {
      this.active.delete(input);
    }
  }

  private project(root: string, tsconfig: string, supplied?: Project): Project {
    const key = path.resolve(root, tsconfig);
    this.files.add(key);
    let project = this.projects.get(key);
    if (!project) {
      project = supplied ?? this.load(root, tsconfig);
      this.projects.set(key, project);
      for (const file of project.files) this.files.add(file);
      for (const directory of project.directories) this.roots.add(directory);
      this.onProject?.(project);
    }
    return project;
  }

  /** Load the complete project graph before assigning any schema names. */
  private prepare(
    input: GenerateOptions,
    baseRoot: string,
    active: Set<GenerateOptions>,
    budget: { count: number },
  ): void {
    if (active.has(input) || active.size >= 100)
      throw new GenerationError('Circular or excessive project document composition.');
    if (++budget.count > 1000)
      throw new GenerationError('Document composition exceeds 1000 generations.');
    validateOptions(input);
    const root = path.resolve(baseRoot, input.root ?? '.');
    this.project(root, input.tsconfig);
    if (input.namespaces !== undefined)
      this.namespaceScopes.push({ root, namespaces: input.namespaces });
    active.add(input);
    try {
      for (const entry of input.documents ?? []) {
        if (!entry || typeof entry !== 'object' || !entry.options)
          throw new GenerationError('Each document entry requires generation options.');
        this.prepare(entry.options, root, active, budget);
      }
    } finally {
      active.delete(input);
    }
  }

  private compile(
    options: GenerateOptions & Pick<ParserOptions, 'info'>,
    project: Project,
  ): Generation {
    const context = new ParserContext(
      project,
      options,
      this.identities!,
      Boolean(options.documents?.length),
    );
    new ParserPipeline(options.parsers ?? this.defaultParsers()).run(context);
    this.onContext?.(context);
    validateJson(context.document, 'Parser document');
    validateJson(context.schemas, 'Standalone schema collection');
    let result = { document: context.document, schemas: context.schemas };
    const files = new Set([...project.files, ...this.metadataFiles]);
    const roots = new Set(project.directories);
    const warnings = [...context.warnings];
    const models: SchemaExport[] = context.declarations
      .filter((item) => item.emitSchema)
      .map((item) => {
        const component = componentName(context.identities.name(item.node) ?? item.name);
        const parts = component.split('.');
        parts.pop();
        return { component, module: parts.length ? parts.join('/') : 'models', name: item.name };
      });
    const parts = [];
    for (const entry of options.documents ?? []) {
      if (!entry || typeof entry !== 'object' || !entry.options)
        throw new GenerationError('Each document entry requires generation options.');
      const childOptions = {
        ...entry.options,
        openapi: entry.options.openapi ?? options.openapi ?? DEFAULT_OPENAPI,
        ...(entry.options.parsers === undefined && options.parsers !== undefined
          ? { parsers: options.parsers }
          : {}),
      };
      const child = this.run(childOptions, undefined, options.root);
      models.push(...child.models);
      parts.push({
        document: child.document,
        ...(entry.tags !== undefined ? { tags: entry.tags } : {}),
        ...(entry.path !== undefined ? { path: entry.path } : {}),
        ...(entry.operationIdPrefix !== undefined
          ? { operationIdPrefix: entry.operationIdPrefix }
          : {}),
      });
      for (const file of child.files) files.add(file);
      for (const root of child.watchRoots ?? []) roots.add(root);
      warnings.push(...child.warnings);
      for (const [name, schema] of Object.entries(child.schemas)) {
        if (
          Object.hasOwn(result.schemas, name) &&
          stableJson(result.schemas[name]) !== stableJson(schema)
        )
          throw new GenerationError(`Conflicting standalone schema ${name} across documents.`);
        result.schemas[name] = schema;
      }
    }
    if (parts.length) result = { ...result, document: mergeDocuments(result.document, parts) };
    const document = modifyDocument(result.document, options.modifiers);
    if (document.openapi !== (options.openapi ?? DEFAULT_OPENAPI))
      throw new GenerationError('Modifiers must preserve the configured OpenAPI version.');
    new DocumentValidation().validate(document);
    validateJson(result.schemas, 'Standalone schema collection');
    if (!result.schemas || typeof result.schemas !== 'object' || Array.isArray(result.schemas))
      throw new GenerationError('Standalone schemas must be an object.');
    const filenames = new Map<string, string>();
    const schemas = Object.fromEntries(
      Object.entries(result.schemas).map(([name, schema]): [string, Schema] => {
        if (name.length > 250 || componentName(name) !== name)
          throw new GenerationError(`Invalid standalone schema filename ${name}.`);
        if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))
          throw new GenerationError(
            `Reserved Windows standalone schema filename ${name}. Choose a portable @schemaName.`,
          );
        const previous = filenames.get(name.toLowerCase());
        if (previous !== undefined)
          throw new GenerationError(
            `Standalone schema filenames ${previous} and ${name} collide on case-insensitive file systems.`,
          );
        filenames.set(name.toLowerCase(), name);
        const source = {
          location: `Standalone schema ${name}`,
          fail(message: string): never {
            throw new GenerationError(`Standalone schema ${name}: ${message}`);
          },
        };
        return [name, explicitSchema(schema, {}, source, 'standalone')];
      }),
    );
    // Rule and configuration references must not remain live across later filesystem/Vite work.
    let snapshot: Pick<Generation, 'document' | 'schemas'>;
    try {
      snapshot = structuredClone({ document, schemas });
    } catch (error) {
      throw new GenerationError(`Cannot snapshot generated JSON: ${String(error)}`);
    }
    return {
      ...snapshot,
      models: [...new Map(models.map((model) => [model.component, model])).values()],
      warnings: [...new Set(warnings)],
      files: [...files].sort(),
      watchRoots: [...roots].sort(),
    };
  }
}
