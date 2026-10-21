interface Item {
  id: string;
  parent?: Item;
}
/**
 * Read item metadata.
 * @route GET,POST /items/{id}
 * @operationId readItem
 */
export interface ReadItem {
  params: { id: string };
  responses: { 200: { body: Item } };
}
