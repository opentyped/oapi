import type { components } from './schema.js';
type Ranking = components['schemas']['Ranking'];
const ranking: Ranking = { zeta: 'z', alpha: 'a', item10: 10, item2: 2, mid: true };
void ranking;
