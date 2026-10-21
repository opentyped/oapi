/** @schema */
export interface XmlReport {
  /** @xml {"name": "identifier", "attribute": true} */
  id: string;
  /** @xml {"name": "display_name"} */
  displayName: string;
  /** @xml {"wrapped": true} */
  tags: string[];
}
