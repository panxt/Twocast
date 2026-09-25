import { integer, pgTable, varchar, json, timestamp, numeric, serial, bigint, smallint, boolean, text, primaryKey } from "drizzle-orm/pg-core";

export const tasksTable = pgTable('tasks', {
  id: integer().primaryKey().generatedByDefaultAsIdentity(),
  // UUID
  uuid: varchar('uuid', { length: 64 }).notNull().unique(),
  // 会员ID
  userId: bigint('user_id', { mode: 'number' }).notNull(),
  userEmail: varchar('user_email', { length: 255 }).notNull(),
  // 用户输入
  userInputs: json('user_inputs'),
  // 结果
  result: json('result').default({}),
  // 状态:0=待执行,1=已提交,2=成功,3=失败
  status: varchar('status', { length: 10 }).notNull(),
  // 状态原因
  statusReason: json('status_reason'),
  // 状态更新时间
  statusAt: timestamp('status_at', { withTimezone: true }),
  // 当前步骤
  currentStep: varchar('current_step', { length: 32 }).default(''),
  // 步骤详情，包含每个步骤的输入、输出和错误信息
  stepsDetail: json('steps_detail').default({}),
  // 消耗积分
  consumedCredits: integer('consumed_credits').notNull(),
  // 精选
  isFeatured: boolean('is_featured').default(false),
  folderPath: varchar('folder_path', { length: 255 }).notNull().default('/'),
  labels: json('labels').$type<string[]>().notNull().default([]),
  visibility: varchar('visibility', { length: 8 }).$type<'private' | 'team'>().notNull().default('private'),
  // 创建时间
  createdAt: timestamp('created_at', { withTimezone: true }),
  // 更新时间
  updatedAt: timestamp('updated_at', { withTimezone: true })
});

export const inviteCodesTable = pgTable('invite_codes', {
  id: integer().primaryKey().generatedByDefaultAsIdentity(),
  codeHash: varchar('code_hash', { length: 64 }).notNull().unique(),
  label: varchar('label', { length: 120 }),
  maxUses: integer('max_uses').notNull().default(1),
  usedCount: integer('used_count').notNull().default(0),
  dailyMaxUses: integer('daily_max_uses'),
  dailyUsedCount: integer('daily_used_count').notNull().default(0),
  dailyUsedOn: varchar('daily_used_on', { length: 10 }),
  teamAccess: boolean('team_access').notNull().default(false),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessionsTable = pgTable('invite_sessions', {
  id: integer().primaryKey().generatedByDefaultAsIdentity(),
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
  inviteCodeId: integer('invite_code_id'),
  role: varchar('role', { length: 16 }).notNull().default('member'),
  teamAccess: boolean('team_access').notNull().default(false),
  loginCodeHash: varchar('login_code_hash', { length: 64 }).unique(),
  displayName: varchar('display_name', { length: 80 }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const appSettingsTable = pgTable('app_settings', {
  key: varchar('key', { length: 80 }).primaryKey(),
  encryptedValue: text('encrypted_value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const userApiSettingsTable = pgTable('user_api_settings', {
  userId: integer('user_id').notNull(),
  key: varchar('key', { length: 80 }).notNull(),
  encryptedValue: text('encrypted_value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [primaryKey({ columns: [table.userId, table.key] })]);

export const apiGrantsTable = pgTable('api_grants', {
  id: integer().primaryKey().generatedByDefaultAsIdentity(),
  userId: integer('user_id'),
  inviteCodeId: integer('invite_code_id'),
  capability: varchar('capability', { length: 16 }).notNull(),
  maxEpisodes: integer('max_episodes').notNull(),
  usedEpisodes: integer('used_episodes').notNull().default(0),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const memberApiSharesTable = pgTable('member_api_shares', {
  id: integer().primaryKey().generatedByDefaultAsIdentity(),
  ownerUserId: integer('owner_user_id').notNull(),
  recipientUserId: integer('recipient_user_id').notNull(),
  capability: varchar('capability', { length: 16 }).notNull(),
  maxEpisodes: integer('max_episodes').notNull(),
  usedEpisodes: integer('used_episodes').notNull().default(0),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
