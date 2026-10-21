interface Column<T, NotNull extends boolean, Default extends boolean> {
  data: T;
  notNull: NotNull;
  hasDefault: Default;
}
interface Table<C extends Record<string, Column<unknown, boolean, boolean>>> {
  $inferSelect: {
    [K in keyof C]: C[K]['notNull'] extends true ? C[K]['data'] : C[K]['data'] | null;
  };
  $inferInsert: {
    [
      K in keyof C as C[K]['notNull'] extends true
        ? C[K]['hasDefault'] extends false
          ? K
          : never
        : never
    ]: C[K]['data'];
  } & {
    [
      K in keyof C as C[K]['notNull'] extends false
        ? K
        : C[K]['hasDefault'] extends true
          ? K
          : never
    ]?: C[K]['notNull'] extends true ? C[K]['data'] : C[K]['data'] | null;
  };
}
interface Profile {
  /** @minLength 2 */
  bio: string;
  tags: string[];
  parent?: Profile;
}
export declare const users: Table<{
  id: Column<number, true, true>;
  name: Column<string, true, false>;
  role: Column<'admin' | 'member', true, false>;
  active: Column<boolean, true, true>;
  profile: Column<Profile, false, false>;
  createdAt: Column<string, true, true>;
}>;

/** @schema */
export type User = typeof users.$inferSelect;
/** @schema */
export type NewUser = typeof users.$inferInsert;
