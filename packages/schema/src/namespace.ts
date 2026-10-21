import fs from 'node:fs';
import path from 'node:path';
import { Minimatch } from 'minimatch';

const namePattern = /^[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*$/;

function contains(directory: string, file: string): boolean {
  const relative = path.relative(directory, file);
  return !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`);
}

function physical(file: string): string {
  if (fs.existsSync(file)) return fs.realpathSync(file);
  const parent = path.dirname(file);
  return parent === file ? file : path.join(physical(parent), path.basename(file));
}

/** Positive file globs are matched against canonical paths, independent of import spelling. */
export class SchemaNamespace {
  private readonly root: string;
  private readonly mappings: { base: string; name: string; matcher: Minimatch; pattern: string }[] =
    [];
  private readonly files = new Map<string, string>();

  constructor(root: string, namespaces: Readonly<Record<string, string>> = {}) {
    this.root = fs.realpathSync(root);
    if (!fs.statSync(this.root).isDirectory()) throw new Error('Schema root must be a directory');
    if (!namespaces || typeof namespaces !== 'object' || Array.isArray(namespaces)) {
      throw new Error('Schema namespaces must map relative file globs to namespace names');
    }
    const owners = new Map<string, { pattern: string; name: string }>();
    for (const [pattern, name] of Object.entries(namespaces)) {
      if (
        !pattern ||
        (pattern.startsWith('!') && !pattern.startsWith('!(')) ||
        path.isAbsolute(pattern) ||
        pattern.includes('\\') ||
        pattern.includes('\0') ||
        /^[a-z]:\//i.test(pattern)
      ) {
        throw new Error(`Schema namespace glob '${pattern}' must be a positive relative file glob`);
      }
      if (typeof name !== 'string' || !namePattern.test(name)) {
        throw new Error(
          `Schema namespace '${String(name)}' must contain dotted identifier segments`,
        );
      }
      const matcher = new Minimatch(pattern.replace(/^(?:\.\/)+/, ''), {
        dot: true,
        nonegate: true,
        nocomment: true,
      });
      if (!matcher.set.length) throw new Error(`Schema namespace glob '${pattern}' is invalid`);
      const prefixes = matcher.set.map((parts) => {
        const prefix: string[] = [];
        for (const part of parts) {
          if (typeof part !== 'string') break;
          prefix.push(part);
        }
        if (prefix.length === parts.length) prefix.pop();
        return prefix;
      });
      // A shared prefix ends at the first differing branch segment.
      let commonLength = 0;
      while (
        commonLength < prefixes[0]!.length &&
        prefixes.every((prefix) => prefix[commonLength] === prefixes[0]![commonLength])
      )
        commonLength++;
      const base = physical(path.resolve(this.root, ...prefixes[0]!.slice(0, commonLength)));
      for (let index = 0; index < matcher.globParts.length; index++) {
        const parts = matcher.globParts[index]!;
        const expanded = [
          ...path.relative(this.root, base).split(path.sep).filter(Boolean),
          ...parts.slice(commonLength),
        ].join('/');
        const canonical = new Minimatch(expanded, { dot: true, nonegate: true, nocomment: true });
        const previous = owners.get(expanded);
        if (previous) {
          if (previous.name !== name)
            throw new Error(
              `Schema namespace globs '${previous.pattern}' and '${pattern}' select the same physical pattern with different names`,
            );
          continue;
        }
        owners.set(expanded, { pattern, name });
        this.mappings.push({ base, name, matcher: canonical, pattern });
      }
    }
    this.mappings.sort((left, right) => right.base.length - left.base.length);
  }

  scope(file: string): string {
    let canonical = this.files.get(file);
    if (!canonical) {
      canonical = physical(file);
      this.files.set(file, canonical);
    }
    const relative = path.relative(this.root, canonical).split(path.sep).join('/');
    const matches = this.mappings.filter(
      ({ matcher, base }) => contains(base, canonical) && matcher.match(relative),
    );
    const mapping = matches[0];
    if (!mapping)
      return relative
        .replace(/\.[cm]?tsx?$/, '')
        .split('/')
        .join('.');
    if (
      matches.some(
        (other) => other.base.length === mapping.base.length && other.name !== mapping.name,
      )
    ) {
      throw new Error(
        `Ambiguous schema namespace globs for '${relative}'; configure a more-specific folder glob`,
      );
    }
    const descendants = path
      .relative(mapping.base, path.dirname(canonical))
      .split(path.sep)
      .filter(Boolean);
    const scope = [mapping.name, ...descendants].join('.');
    if (!namePattern.test(scope))
      throw new Error(
        `Schema folder namespace '${scope}' has invalid segments; configure that folder explicitly`,
      );
    return scope;
  }
}
