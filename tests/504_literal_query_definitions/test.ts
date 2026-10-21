/** @route GET /feeds */
export interface ReadFeed {
  query: {
    /** Feed format. */
    format?: 'rss' | 'atom';
    limit?: number;
  };
  responses: { 200: { body: { entries: number } } };
}
