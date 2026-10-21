/** @schema */
export interface Model {
  key: `evt_${'created' | 'deleted'}_${1 | 2}`;
  /** @pattern ^item_[0-9]+$ */
  numeric: `item_${number}`;
}
