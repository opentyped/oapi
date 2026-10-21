import type { components } from './schema.js';
const any: components['schemas']['Any'] = 'a';
const one: components['schemas']['One'] = 'b';
const both: components['schemas']['Both'] = 'b';
// @ts-expect-error Base string type does not permit bypassing anyOf.
const wideAny: components['schemas']['Any'] = 'other';
// @ts-expect-error Base string type does not permit bypassing oneOf.
const wideOne: components['schemas']['One'] = 'other';
// @ts-expect-error Both composition keywords apply independently.
const wideBoth: components['schemas']['Both'] = 'a';
// @ts-expect-error An allOf false schema has no inhabitants.
const impossible: components['schemas']['Impossible'] = {};
void [any, one, both, wideAny, wideOne, wideBoth, impossible];
