import type { paths } from './schema.js';
type V1 = paths['/v1/ping']['get'];
type V2 = paths['/v2/ping']['get'];
declare const v1: V1;
declare const v2: V2;
const viaV1: { pong: boolean } = v1.responses[200]['content']['application/json'];
const viaV2: typeof viaV1 = v2.responses[200]['content']['application/json'];
// @ts-expect-error Every mounted prefix produces the same operation contract.
const wrong: { note: string } = v2.responses[200]['content']['application/json'];
void [viaV1, viaV2, wrong];
