import type { paths, operations } from './schema.js';
type Purge = operations['PurgeContract'];
declare const purge: Purge;
const ok: undefined = purge.responses[204]['content'];
const reason: string = purge.responses.default['content']['application/json'].reason;
declare const item: paths['/items'];
const viaAdditional: typeof purge = item.additionalOperations.PURGE;
// @ts-expect-error The default fallback still requires its declared body.
const wrong: { note: string } = purge.responses.default['content']['application/json'];
void [ok, reason, viaAdditional, wrong];
