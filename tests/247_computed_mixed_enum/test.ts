enum Mixed {
  Code = 1,
  Runtime = Math.random(),
  Label = 'label',
  Other = 'other',
  /** @hidden */
  Ignored = 'hidden',
}

/** @schema */
export interface Model {
  mode: Mixed;
  computed: Mixed.Runtime;
  label: Mixed.Label;
  previous?: Model;
}
