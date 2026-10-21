import type { components } from './schema.js';
type Catalog = components['schemas']['Catalog'];
const valid: Catalog = { label: 'label', record: { label: 'nested' }, choice: 'b' };
// @ts-expect-error Referenced string schemas reject undefined.
const wrongLabel: Catalog = { label: undefined, record: { label: 'nested' }, choice: 'a' };
// @ts-expect-error Referenced enums retain literal members.
const wrongChoice: Catalog = { label: 'label', record: { label: 'nested' }, choice: 'c' };
// @ts-expect-error A required field referencing an optional property still excludes undefined.
const undefinedChoice: Catalog = { label: 'label', record: { label: 'nested' }, choice: undefined };
void [valid, wrongLabel, wrongChoice, undefinedChoice];
