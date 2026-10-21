import { pgTable, serial, text, boolean, jsonb, timestamp } from 'drizzle-orm/pg-core';

interface Profile {
  /** @minLength 2 */
  bio: string;
  tags: string[];
  parent?: Profile;
}
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role', { enum: ['admin', 'member'] }).notNull(),
  active: boolean('active').default(true).notNull(),
  profile: jsonb('profile').$type<Profile>(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
});

/** @schema */
export type User = typeof users.$inferSelect;
/** @schema */
export type NewUser = typeof users.$inferInsert;
