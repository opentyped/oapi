import type { components } from './schema.js';
const published: components['schemas']['Published'] = 'published';
// @ts-expect-error The sibling const narrows the referenced enum.
const draft: components['schemas']['Published'] = 'draft';
// @ts-expect-error A string enum intersected with number has no inhabitants.
const impossible: components['schemas']['Impossible'] = 123;
void [published, draft, impossible];

const body: components['schemas']['Body'] = {};
const required: components['schemas']['RequiredBody'] = { label: 'required' };
// @ts-expect-error Sibling required makes the referenced optional field mandatory.
const missing: components['schemas']['RequiredBody'] = {};
void [body, required, missing];
