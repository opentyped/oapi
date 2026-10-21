/**
 * @schema
 * @xml {"name":"user","namespace":"https://example.com/users","prefix":"u"}
 */
export interface XmlUser {
  /** @xml {"attribute":true,"prefix":"u"} */
  id: string;
  /** @xml {"name":"display_name"} */
  displayName: string;
  /** @xml {"name":"labels","wrapped":true} */
  labels: string[];
  /** @xml {"name":"manager"} */
  manager?: XmlUser;
}

/** @schema */
export interface XmlEnvelope {
  /**
   * @inline
   * @xml {"name":"account"}
   */
  user: XmlUser;
}
