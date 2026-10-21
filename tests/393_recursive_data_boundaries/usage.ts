import type { components } from './schema.js';
type Node = components['schemas']['tree.Node'];
const tree: Node = {
  id: 'root',
  allOf: { id: 'one' },
  not: null,
  children: [{ id: 'two' }],
  dictionary: { leaf: { id: 'three', not: { id: 'four' } } },
};
// @ts-expect-error Keyword-like field names remain ordinary recursive data.
const wrongField: Node = { id: 'root', allOf: 123 };
// @ts-expect-error Dictionary recursion preserves the node schema.
const wrongDictionary: Node = { id: 'root', dictionary: { leaf: { id: 123 } } };
void [tree, wrongField, wrongDictionary];
