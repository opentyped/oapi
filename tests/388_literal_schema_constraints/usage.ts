import type { components } from './schema.js';
const nil: components['schemas']['Null'] = null;
const choice: components['schemas']['Choice'] = 'b';
const object: components['schemas']['Objects'] = { kind: 'one' };
const nonNull: components['schemas']['NonNull'] = 'a';
// @ts-expect-error const null excludes strings.
const wrongNull: components['schemas']['Null'] = 'null';
// @ts-expect-error enum and allOf both apply.
const wrongChoice: components['schemas']['Choice'] = 'a';
// @ts-expect-error enum does not gain null merely because type permits null.
const wrongNonNull: components['schemas']['NonNull'] = null;
// @ts-expect-error Object enum values are literal shapes, not schema objects.
const wrongObject: components['schemas']['Objects'] = { kind: 'other' };
// @ts-expect-error Contradictory type and const have no inhabitants.
const impossible: components['schemas']['Wrong'] = 'string';
void [nil, choice, object, nonNull, wrongNull, wrongChoice, wrongNonNull, wrongObject, impossible];
