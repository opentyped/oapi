import type { components } from './schema.js';
type XmlReport = components['schemas']['XmlReport'];
const report: XmlReport = { id: 'a', displayName: 'A', tags: ['x'] };
// @ts-expect-error XML annotations do not relax the underlying contracts.
const wrong: XmlReport = { id: 'a', displayName: 'A', tags: [1] };
void [report, wrong];
