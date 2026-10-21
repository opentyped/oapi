import ts from 'typescript';

export function escapePattern(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function templatePattern(key: ts.Type): string | undefined {
  if (!(key.flags & ts.TypeFlags.TemplateLiteral)) return undefined;
  const template = key as ts.TemplateLiteralType;
  if (!template.types.every((part) => !!(part.flags & ts.TypeFlags.String))) return undefined;
  return '^' + template.texts.map(escapePattern).join('[\\s\\S]*') + '(?![\\s\\S])';
}

/** Literal boundaries can prove disjointness; false leaves overlap undecided. */
export function disjointTemplates(left: ts.Type, right: ts.Type): boolean {
  if (!(left.flags & ts.TypeFlags.TemplateLiteral) || !(right.flags & ts.TypeFlags.TemplateLiteral))
    return false;
  const a = (left as ts.TemplateLiteralType).texts;
  const b = (right as ts.TemplateLiteralType).texts;
  const prefix = a[0] ?? '';
  const otherPrefix = b[0] ?? '';
  const suffix = a.at(-1) ?? '';
  const otherSuffix = b.at(-1) ?? '';
  return (
    !(prefix.startsWith(otherPrefix) || otherPrefix.startsWith(prefix)) ||
    !(suffix.endsWith(otherSuffix) || otherSuffix.endsWith(suffix))
  );
}

/** Only unrestricted string holes have an exact representation without numeric coercion rules. */
export function indexPattern(type: ts.Type, checker: ts.TypeChecker): string | undefined {
  const indexes = checker.getIndexInfosOfType(type);
  const first = indexes[0];
  if (
    !first ||
    indexes.some((index) => index.type !== first.type || index.declaration !== first.declaration)
  )
    return undefined;
  const patterns = indexes.map((index) => templatePattern(index.keyType));
  return patterns.some((pattern) => pattern === undefined)
    ? undefined
    : unionPattern(patterns as string[]);
}

/** Resolve separately declared template indexes while retaining their source bindings. */
export function separateIndexes(
  type: ts.Type,
  checker: ts.TypeChecker,
): readonly ts.IndexInfo[] | undefined {
  const indexes = checker.getIndexInfosOfType(type);
  if (
    indexes.length < 2 ||
    !type
      .getSymbol()
      ?.declarations?.some(
        (declaration) =>
          ts.isInterfaceDeclaration(declaration) ||
          ts.isClassDeclaration(declaration) ||
          ts.isTypeLiteralNode(declaration),
      ) ||
    indexes.some((index) => !index.declaration)
  )
    return undefined;
  const contributions: ts.IndexInfo[] = [];
  const seen = new Set<ts.Type>();
  const collect = (current: ts.Type): void => {
    if (seen.has(current)) return;
    if (seen.size >= 10000)
      throw new Error('Template index inheritance exceeds the traversal budget.');
    seen.add(current);
    const owners = current.getSymbol()?.declarations ?? [];
    for (const index of checker.getIndexInfosOfType(current)) {
      if (!index.declaration || !owners.some((owner) => owner === index.declaration!.parent))
        continue;
      if (
        !contributions.some(
          (entry) =>
            entry.declaration === index.declaration &&
            entry.keyType === index.keyType &&
            entry.type === index.type,
        )
      )
        contributions.push(index);
    }
    const reference =
      current.flags & ts.TypeFlags.Object &&
      (current as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference
        ? (current as ts.TypeReference)
        : undefined;
    (current.getBaseTypes() ?? reference?.target.getBaseTypes())?.forEach(collect);
  };
  collect(type);
  if (contributions.length < 2) return undefined;
  if (contributions.some((index) => templatePattern(index.keyType) === undefined)) return undefined;
  return indexes;
}

/** Each alternative retains its end boundary, including newline-safe string holes. */
export function unionPattern(patterns: string[]): string | undefined {
  const unique = [...new Set(patterns)];
  return unique.length > 1
    ? `^(?:${unique.map((pattern) => pattern.slice(1)).join('|')})`
    : unique[0];
}
