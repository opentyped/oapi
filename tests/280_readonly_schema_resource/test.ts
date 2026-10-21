/** @jsonSchema {"$id":"https://example.test/base","$anchor":"node","type":"object","properties":{"name":{"type":"string"},"next":{"$ref":"#node"}},"required":["name"],"additionalProperties":false} */
interface Base {
  name: string;
  next?: Base;
}

/** @schema */
export type Model = Readonly<Base>;
