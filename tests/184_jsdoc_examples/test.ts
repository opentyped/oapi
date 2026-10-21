/**
 * @schema
 * @example {id:'ada', nickname:null, scores:[1,2], owner:{id:'bo',nickname:'B',scores:[]}}
 */
export interface Model {
  /**
   * @example "ada"
   * @example "bo"
   */
  id: string;
  /** @example null */
  nickname: string | null;
  /** @example [1,2] */
  scores: number[];
  owner?: Model;
}
