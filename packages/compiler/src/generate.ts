import type { ParserFactory } from '~/parser/parser';
import type { ParserContext } from '~/parser/context';
import { GenerationSession } from '~/session';
import type { Project } from '@opentyped/ast/project';
import type { GenerateOptions, Generation, DeclarationRenderer } from '~/config';
import { ProjectCache } from '@opentyped/ast/project';
import { ProjectValidation } from '@opentyped/ast/validation';
/** Retains checked TypeScript programs between generations; document state stays per run. */
export class GenerationCompiler {
  private readonly projects = new ProjectCache();
  private readonly validation = new ProjectValidation();

  constructor(private readonly defaults: ParserFactory) {}

  generate(
    options: GenerateOptions,
    onContext?: (context: ParserContext) => void,
    declarations?: DeclarationRenderer,
  ): Generation {
    return new GenerationSession(this.defaults, undefined, onContext, {
      load: this.projects.loadUnchecked,
      validation: this.validation,
      ...(declarations ? { declarations } : {}),
    }).run(options);
  }

  clear(): void {
    this.projects.clear();
    this.validation.clear();
  }
}

export function generate(
  options: GenerateOptions,
  defaults: ParserFactory,
  declarations?: DeclarationRenderer,
): Generation {
  return new GenerationSession(
    defaults,
    undefined,
    undefined,
    declarations ? { declarations } : {},
  ).run(options);
}

/** Internal composition seam for integrations that also consume checked programs. */
export function generateProject(
  options: GenerateOptions,
  project: Project | undefined,
  defaults: ParserFactory,
  onProject?: (project: Project) => void,
  onContext?: (context: ParserContext) => void,
): Generation {
  return new GenerationSession(defaults, onProject, onContext).run(options, project);
}
