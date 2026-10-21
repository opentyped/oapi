import type { components } from './schema.js';
type Profile = components['schemas']['Profile'];
const profile: Profile = { display_name: 'n' };
const renamed: Profile = { display_name: 'n', avatarUrl: 'a' };
// @ts-expect-error Renamed fields keep their declared value types.
const wrong: Profile = { display_name: 1 };
void [profile, renamed, wrong];
