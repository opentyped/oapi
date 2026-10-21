import type { ParserFactory } from '~/parser/parser';
import type { ParserContext } from '~/parser/context';
import { GenerationSession } from '~/session';
import type { Project } from '@typedapi/ast/project';
import type { GenerateOptions, Generation } from '~/config';
import { ProjectCache } from '@typedapi/ast/project';
/** Retains checked TypeScript programs between generations; document state stays per run. */
export class GenerationCompiler {
  private readonly projects = new ProjectCache();

  constructor(private readonly defaults: ParserFactory) {}

  generate(options: GenerateOptions, onContext?: (context: ParserContext) => void): Generation {
    return new GenerationSession(this.defaults, undefined, onContext, this.projects.load).run(
      options,
    );
  }

  clear(): void {
    this.projects.clear();
  }
}

export function generate(options: GenerateOptions, defaults: ParserFactory): Generation {
  return new GenerationSession(defaults).run(options);
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
