import {
  integer,
  pgTable,
  varchar,
  json,
  timestamp,
  numeric,
  serial,
  bigint,
  smallint,
  boolean,
  text,
  primaryKey,
} from 'drizzle-orm/pg-core'

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
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  sharedTeamIds: json('shared_team_ids').$type<number[]>().notNull().default([]),
  quotaTeamId: integer('quota_team_id'),
  audioBytes: bigint('audio_bytes', { mode: 'number' }).notNull().default(0),
  visibility: varchar('visibility', { length: 8 })
    .$type<'private' | 'team' | 'public'>()
    .notNull()
    .default('private'),
  // 封面：supabase-cover:<file> 或本地 /assets/covers/<file>
  coverLocation: varchar('cover_location', { length: 255 }),
  // 创建时间
  createdAt: timestamp('created_at', { withTimezone: true }),
  // 更新时间
  updatedAt: timestamp('updated_at', { withTimezone: true }),
})

export const inviteCodesTable = pgTable('invite_codes', {
  id: integer().primaryKey().generatedByDefaultAsIdentity(),
  codeHash: varchar('code_hash', { length: 64 }).notNull().unique(),
  label: varchar('label', { length: 120 }),
  initialDisplayName: varchar('initial_display_name', { length: 40 }),
  accountRole: varchar('account_role', { length: 16 }).notNull().default('member'),
  maxUses: integer('max_uses').notNull().default(1),
  usedCount: integer('used_count').notNull().default(0),
  dailyMaxUses: integer('daily_max_uses'),
  dailyUsedCount: integer('daily_used_count').notNull().default(0),
  dailyUsedOn: varchar('daily_used_on', { length: 10 }),
  teamAccess: boolean('team_access').notNull().default(false),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const sessionsTable = pgTable('invite_sessions', {
  id: integer().primaryKey().generatedByDefaultAsIdentity(),
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
  inviteCodeId: integer('invite_code_id'),
  role: varchar('role', { length: 16 }).notNull().default('member'),
  disabled: boolean('disabled').notNull().default(false),
  teamAccess: boolean('team_access').notNull().default(false),
  loginCodeHash: varchar('login_code_hash', { length: 64 }).unique(),
  displayName: varchar('display_name', { length: 80 }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const appSettingsTable = pgTable('app_settings', {
  key: varchar('key', { length: 80 }).primaryKey(),
  encryptedValue: text('encrypted_value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const userApiSettingsTable = pgTable(
  'user_api_settings',
  {
    userId: integer('user_id').notNull(),
    key: varchar('key', { length: 80 }).notNull(),
    encryptedValue: text('encrypted_value').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.key] })]
)

export const apiGrantsTable = pgTable('api_grants', {
  id: integer().primaryKey().generatedByDefaultAsIdentity(),
  userId: integer('user_id'),
  inviteCodeId: integer('invite_code_id'),
  capability: varchar('capability', { length: 16 }).notNull(),
  dailyLimit: integer('daily_limit'),
  dailyUsed: integer('daily_used').notNull().default(0),
  dailyOn: varchar('daily_on', { length: 10 }),
  maxEpisodes: integer('max_episodes').notNull(),
  usedEpisodes: integer('used_episodes').notNull().default(0),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const memberApiSharesTable = pgTable('member_api_shares', {
  id: integer().primaryKey().generatedByDefaultAsIdentity(),
  ownerUserId: integer('owner_user_id').notNull(),
  recipientUserId: integer('recipient_user_id').notNull(),
  delegatedByUserId: integer('delegated_by_user_id'),
  parentShareId: integer('parent_share_id'),
  allowReshare: boolean('allow_reshare').notNull().default(false),
  capability: varchar('capability', { length: 16 }).notNull(),
  dailyLimit: integer('daily_limit'),
  dailyUsed: integer('daily_used').notNull().default(0),
  dailyOn: varchar('daily_on', { length: 10 }),
  maxEpisodes: integer('max_episodes').notNull(),
  usedEpisodes: integer('used_episodes').notNull().default(0),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// invite_sessions keeps the stable legacy account IDs; device sessions are separate.
export const deviceSessionsTable = pgTable('device_sessions', {
  id: integer().primaryKey().generatedByDefaultAsIdentity(),
  userId: integer('user_id').notNull(),
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
export const teamsTable = pgTable('teams', {
  id: integer().primaryKey().generatedByDefaultAsIdentity(),
  name: varchar('name', { length: 80 }).notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
export const teamMembersTable = pgTable(
  'team_members',
  {
    teamId: integer('team_id').notNull(),
    userId: integer('user_id').notNull(),
    role: varchar('role', { length: 16 }).notNull().default('member'),
  },
  (t) => [primaryKey({ columns: [t.teamId, t.userId] })]
)
export const inviteTeamsTable = pgTable(
  'invite_teams',
  {
    inviteCodeId: integer('invite_code_id').notNull(),
    teamId: integer('team_id').notNull(),
  },
  (t) => [primaryKey({ columns: [t.inviteCodeId, t.teamId] })]
)
export const quotaPoliciesTable = pgTable(
  'quota_policies',
  {
    scope: varchar('scope', { length: 16 }).notNull(),
    scopeId: integer('scope_id').notNull(),
    dailyLimit: integer('daily_limit'),
    totalLimit: integer('total_limit'),
    concurrentLimit: integer('concurrent_limit'),
    storageBytes: bigint('storage_bytes', { mode: 'number' }),
  },
  (t) => [primaryKey({ columns: [t.scope, t.scopeId] })]
)
export const quotaReservationsTable = pgTable('quota_reservations', {
  uuid: varchar('uuid', { length: 64 }).primaryKey(),
  userId: integer('user_id').notNull(),
  teamId: integer('team_id'),
  kind: varchar('kind', { length: 16 }).notNull().default('generation'),
  cancelled: boolean('cancelled').notNull().default(false),
  bytes: bigint('bytes', { mode: 'number' }).notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
export const externalIdentitiesTable = pgTable(
  'external_identities',
  {
    provider: varchar('provider', { length: 16 }).notNull(),
    subject: varchar('subject', { length: 255 }).notNull(),
    userId: integer('user_id').notNull(),
  },
  (t) => [primaryKey({ columns: [t.provider, t.subject] })]
)

export const importTicketsTable = pgTable('import_tickets', {
  id: varchar('id', { length: 64 }).primaryKey(),
  userId: integer('user_id').notNull(),
  filename: varchar('filename', { length: 255 }).notNull(),
  bytes: bigint('bytes', { mode: 'number' }).notNull(),
  state: varchar('state', { length: 16 }).notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
