import ts from 'typescript';

type Tag = { name: string; value: string };
const tags = new WeakMap<ts.Node, readonly Tag[]>();

export function tagsOf(node: ts.Node): readonly Tag[] {
  const cached = tags.get(node);
  if (cached) return cached;
  const result = ts.getJSDocTags(node).map((tag) => ({
    name: tag.tagName.text,
    value: (typeof tag.comment === 'string'
      ? tag.comment
      : (tag.comment?.map((part) => part.text).join('') ?? '')
    ).trim(),
  }));
  tags.set(node, result);
  return result;
}

export function documentationOf(node: ts.Node): string {
  return ts
    .getJSDocCommentsAndTags(node)
    .filter(ts.isJSDoc)
    .map((doc) =>
      typeof doc.comment === 'string'
        ? doc.comment
        : (doc.comment?.map((part) => part.text).join('') ?? ''),
    )
    .filter(Boolean)
    .join('\n\n')
    .trim();
}
