import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// Users table keyed by unique user ID (Supabase Auth UID or database UID)
export const users = pgTable('users', {
  uid: text('uid').primaryKey(),
  email: text('email').notNull(),
  passwordHash: text('password_hash'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Audits table storing domain deliverability assessments
export const audits = pgTable('audits', {
  id: serial('id').primaryKey(),
  userId: text('user_id')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  domain: text('domain').notNull(),
  score: integer('score').notNull(),
  grade: text('grade').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  resultData: text('result_data').notNull(),
});

// Outreach scripts table storing phone call battlecards
export const outreachScripts = pgTable('outreach_scripts', {
  id: serial('id').primaryKey(),
  userId: text('user_id')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  domain: text('domain').notNull(),
  companyName: text('company_name'),
  grade: text('grade'),
  score: integer('score'),
  scriptData: text('script_data').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Callers table for role-based phone outreach
export const callers = pgTable('callers', {
  id: serial('id').primaryKey(),
  callerKey: text('caller_key').notNull().unique(),
  name: text('name').notNull(),
  fixedCode: text('fixed_code').notNull(),
  email: text('email'),
  lastLoginAt: timestamp('last_login_at'),
});

// Lead assignments table for splitting leads without duplicates among the 4 callers
export const leadAssignments = pgTable('lead_assignments', {
  id: serial('id').primaryKey(),
  callerKey: text('caller_key').notNull(),
  callerName: text('caller_name').notNull(),
  domain: text('domain').notNull(),
  phone: text('phone'),
  companyName: text('company_name'),
  grade: text('grade'),
  score: integer('score'),
  resultData: text('result_data'),
  status: text('status').default('pending').notNull(),
  notes: text('notes'),
  batchId: text('batch_id'),
  assignedAt: timestamp('assigned_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relationships
export const usersRelations = relations(users, ({ many }) => ({
  audits: many(audits),
  outreachScripts: many(outreachScripts),
}));

export const auditsRelations = relations(audits, ({ one }) => ({
  user: one(users, {
    fields: [audits.userId],
    references: [users.uid],
  }),
}));

export const outreachScriptsRelations = relations(outreachScripts, ({ one }) => ({
  user: one(users, {
    fields: [outreachScripts.userId],
    references: [users.uid],
  }),
}));
