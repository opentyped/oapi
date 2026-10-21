import type { components } from './schema.js';
type Measurement = components['schemas']['Measurement'];
const measurement: Measurement = { level: 2, rate: 1 };
// @ts-expect-error Numeric enums keep their literal members.
const wrong: Measurement = { level: 4, rate: 1 };
void [measurement, wrong];
