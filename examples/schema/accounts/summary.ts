import type { User } from './user';

/** @schema */
export type UserSummary = Pick<User, 'id' | 'name'>;

interface Page<T> {
  items: T[];
  next?: string;
}

/** @schema */
export type UserPage = Page<UserSummary>;
