import type { components } from './schema.js';
const user: components['schemas']['accounts.User'] = {};
const property: components['schemas']['Property'] = 'string';
const item: components['schemas']['Item'] = 42;
const percent: components['schemas']['Percent'] = true;
const escaped: components['schemas']['Escaped'] = 1;
const fragment: components['schemas']['Fragment'] = null;
// @ts-expect-error Schema pointers target the field schema, not its enclosing object.
const wrongProperty: components['schemas']['Property'] = {};
// @ts-expect-error Referencing an optional property's schema does not add undefined.
const missingProperty: components['schemas']['Property'] = undefined;
// @ts-expect-error An array items pointer describes a number, not an array.
const wrongItem: components['schemas']['Item'] = [42];
// @ts-expect-error Percent-encoded pointer tokens retain their target type.
const wrongPercent: components['schemas']['Percent'] = 'true';
void [
  user,
  property,
  item,
  percent,
  escaped,
  fragment,
  wrongProperty,
  missingProperty,
  wrongItem,
  wrongPercent,
];
