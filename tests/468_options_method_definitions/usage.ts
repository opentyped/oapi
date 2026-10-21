import type { paths } from './schema.js';
type Preflight = paths['/preflight']['options'];
declare const preflight: Preflight;
const absent: undefined = preflight.responses[204]['content'];
// @ts-expect-error OPTIONS responses without content keep content absent.
const wrong: { note: string } = preflight.responses[204]['content']['application/json'];
void [absent, wrong];
