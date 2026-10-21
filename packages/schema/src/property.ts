import ts from 'typescript';
import { tagsOf } from '@typedapi/ast/jsdoc';
import { SchemaError } from '~/error';

const NAME_RULES = new Set([
  'lowercase',
  'UPPERCASE',
  'PascalCase',
  'camelCase',
  'snake_case',
  'SCREAMING_SNAKE_CASE',
  'kebab-case',
  'SCREAMING-KEBAB-CASE',
]);

export function modelRule(node: ts.Node): string | undefined {
  const tags = tagsOf(node).filter((tag) => tag.name === 'renameAll');
  if (!tags.length) return undefined;
  if (tags.length > 1) throw new Error('Duplicate @renameAll schema annotation.');
  if (
    !ts.isInterfaceDeclaration(node) &&
    !ts.isClassDeclaration(node) &&
    !(ts.isTypeAliasDeclaration(node) && ts.isTypeLiteralNode(node.type))
  )
    throw new Error('@renameAll applies to interfaces, classes and object-literal type aliases.');
  const rule = tags[0]!.value;
  if (!NAME_RULES.has(rule))
    throw new Error(`Unsupported @renameAll rule ${JSON.stringify(rule)}.`);
  return rule;
}

export function fieldRule(node: ts.Node): { rule: string } | undefined {
  if (
    !ts.isPropertySignature(node) &&
    !ts.isPropertyDeclaration(node) &&
    !ts.isGetAccessorDeclaration(node) &&
    !ts.isSetAccessorDeclaration(node)
  )
    return undefined;
  if (!node.parent) return undefined;
  let owner = ts.getOriginalNode(node.parent);
  if (ts.isTypeLiteralNode(owner) && owner.parent && ts.isTypeAliasDeclaration(owner.parent))
    owner = owner.parent;
  const rule = modelRule(owner);
  return rule === undefined ? undefined : { rule };
}

/** Serde field rules preserve punctuation and use ASCII case conversion. */
export function renameField(name: string, rule: string): string {
  const upper = (value: string): string =>
    value.replace(/[a-z]/g, (letter) => letter.toUpperCase());
  switch (rule) {
    case 'lowercase':
    case 'snake_case':
      return name;
    case 'UPPERCASE':
    case 'SCREAMING_SNAKE_CASE':
      return upper(name);
    case 'kebab-case':
      return name.replaceAll('_', '-');
    case 'SCREAMING-KEBAB-CASE':
      return upper(name).replaceAll('_', '-');
    case 'PascalCase':
    case 'camelCase': {
      const pascal = name
        .replace(/(^|_+)([^_])/g, (_match, _prefix: string, letter: string) => upper(letter))
        .replaceAll('_', '');
      return rule === 'PascalCase'
        ? pascal
        : pascal.replace(/^[A-Z]/, (letter) => letter.toLowerCase());
    }
    default:
      throw new Error(`Unsupported @renameAll rule ${JSON.stringify(rule)}.`);
  }
}

export function fieldName(node: ts.Node): string | undefined {
  const tags = tagsOf(node).filter((tag) => tag.name === 'rename');
  if (!tags.length) return undefined;
  if (tags.length > 1) throw new Error('Duplicate @rename schema annotation.');
  if (
    !ts.isPropertySignature(node) &&
    !ts.isPropertyDeclaration(node) &&
    !ts.isGetAccessorDeclaration(node) &&
    !ts.isSetAccessorDeclaration(node)
  )
    throw new Error('@rename applies to model fields.');
  let value: unknown;
  try {
    value = JSON.parse(tags[0]!.value);
  } catch {
    throw new Error('@rename requires a JSON string property name.');
  }
  if (typeof value !== 'string') throw new Error('@rename requires a JSON string property name.');
  return value;
}

export function propertyName(name: string, node: ts.Node): string {
  const explicit = fieldName(node);
  if (explicit !== undefined) return explicit;
  const rule = fieldRule(node);
  return rule ? renameField(name, rule.rule) : name;
}

/** An override may refine a value, but cannot give one inherited field conflicting wire names. */
export function wirePropertyName(
  checker: ts.TypeChecker,
  owner: ts.Type,
  property: ts.Symbol,
  fallback: ts.Node,
): string {
  const declarations = new Set(property.declarations);
  const active = new Set<ts.Type>();
  const collect = (type: ts.Type): void => {
    if (active.has(type)) return;
    active.add(type);
    if (active.size > 128)
      throw new SchemaError('Inherited field names exceed 128 types', fallback);
    for (const node of checker.getPropertyOfType(type, property.name)?.declarations ?? [])
      declarations.add(node);
    for (const base of type.getBaseTypes() ?? []) collect(base);
    if (type.isIntersection()) type.types.forEach(collect);
  };
  collect(owner);
  const names = new Set([...declarations].map((node) => propertyName(property.name, node)));
  if (names.size > 1)
    throw new SchemaError(
      `Conflicting inherited field renames for ${JSON.stringify(property.name)}`,
      fallback,
    );
  return names.values().next().value ?? propertyName(property.name, fallback);
}
