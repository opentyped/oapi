import type { components } from './schema.js';
type Preferences = components['schemas']['Preferences'];
const minimal: Preferences = {};
const full: Preferences = { theme: 'dark', fontSize: 14, notifications: true };
// @ts-expect-error Optional members keep their declared types.
const wrong: Preferences = { theme: 'blue' };
void [minimal, full, wrong];
