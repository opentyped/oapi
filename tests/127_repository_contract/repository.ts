interface StoredUser {
  id: string;
  /** @minLength 2 */
  name: string;
  manager?: StoredUser;
}
export declare class UserRepository {
  find(id: string): Promise<StoredUser | undefined>;
}
/** @schema */
export type UserRecord = NonNullable<Awaited<ReturnType<UserRepository['find']>>>;
