/** @schema */
export interface Leaf {
  value: string;
}

/**
 * @schema
 * @jsonSchema {"type":"object","properties":{"kind":{"type":"string"}},"required":["kind"],"discriminator":{"propertyName":"kind","mapping":{"leaf":"Leaf"}}}
 */
export interface Choice {
  kind: string;
}
