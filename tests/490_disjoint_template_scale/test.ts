/** @schema */
export interface Model {
  version: 1;
  [key: `alpha_${string}`]: string;
  [key: `beta_${string}`]: number;
  [key: `gamma_${string}`]: boolean;
  [key: `delta_${string}`]: string[];
  [key: `epsilon_${string}`]: { label: string };
  [key: `zeta_${string}`]: Model;
  [key: `eta_${string}`]: null;
}
