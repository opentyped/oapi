export type { User as AccountUser, User as ReexportedUser } from './accounts.js';

/** @schema @jsonSchema {"$ref":"#/components/schemas/accounts.User/properties/properties"} */
export type Property = unknown;
/** @schema @jsonSchema {"$ref":"#/components/schemas/accounts.User/properties/items/items"} */
export type Item = unknown;
/** @schema @jsonSchema {"$ref":"#/components/schemas/accounts.User/properties/a%25b"} */
export type Percent = unknown;
/** @schema @jsonSchema {"$ref":"#/components/schemas/accounts.User/properties/slash~1~0"} */
export type Escaped = unknown;
/** @schema @jsonSchema {"$ref":"#/components/schemas/accounts.User/properties/%23"} */
export type Fragment = unknown;
