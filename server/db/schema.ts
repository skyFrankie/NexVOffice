import { pgTable, uuid, varchar, text, boolean, integer, timestamp, jsonb, pgEnum, vector } from 'drizzle-orm/pg-core'

// Enums
export const userRoleEnum = pgEnum('user_role', ['admin', 'member'])
export const npcTypeEnum = pgEnum('npc_type', ['agent', 'ghost'])
export const chatChannelTypeEnum = pgEnum('chat_channel_type', ['public', 'room', 'dm', 'npc'])
export const taskStatusEnum = pgEnum('task_status', ['todo', 'in_progress', 'done'])

// Users
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  avatar: varchar('avatar', { length: 50 }).notNull().default('adam'),
  role: userRoleEnum('role').notNull().default('member'),
  mustChangePassword: boolean('must_change_password').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Office Layout
export const officeLayout = pgTable('office_layout', {
  id: uuid('id').defaultRandom().primaryKey(),
  gridWidth: integer('grid_width').notNull().default(5),
  gridHeight: integer('grid_height').notNull().default(5),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Room Templates
export const roomTemplates = pgTable('room_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  category: varchar('category', { length: 50 }).notNull(),
  widthBlocks: integer('width_blocks').notNull().default(1),
  heightBlocks: integer('height_blocks').notNull().default(1),
  tileData: jsonb('tile_data').notNull(),
  isBuiltIn: boolean('is_built_in').notNull().default(false),
  features: jsonb('features').notNull().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Room Placements
export const roomPlacements = pgTable('room_placements', {
  id: uuid('id').defaultRandom().primaryKey(),
  layoutId: uuid('layout_id').references(() => officeLayout.id).notNull(),
  templateId: uuid('template_id').references(() => roomTemplates.id).notNull(),
  gridX: integer('grid_x').notNull(),
  gridY: integer('grid_y').notNull(),
  roomName: varchar('room_name', { length: 100 }),
  config: jsonb('config').default({}),
})

// Chat Channels
export const chatChannels = pgTable('chat_channels', {
  id: uuid('id').defaultRandom().primaryKey(),
  type: chatChannelTypeEnum('type').notNull(),
  roomId: uuid('room_id'),
  name: varchar('name', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Chat Messages
export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  channelId: uuid('channel_id').references(() => chatChannels.id).notNull(),
  senderId: uuid('sender_id').references(() => users.id).notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Tasks
export const tasks = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  status: taskStatusEnum('status').notNull().default('todo'),
  assigneeId: uuid('assignee_id').references(() => users.id),
  assignedBy: uuid('assigned_by').references(() => users.id),
  dueDate: timestamp('due_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Daily Schedules
export const dailySchedules = pgTable('daily_schedules', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  dayOfWeek: integer('day_of_week').notNull(),
  startTime: varchar('start_time', { length: 5 }).notNull(),
  endTime: varchar('end_time', { length: 5 }).notNull(),
  label: varchar('label', { length: 100 }).notNull(),
})

// NPC Agents
export const npcAgents = pgTable('npc_agents', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  type: npcTypeEnum('type').notNull().default('agent'),
  avatar: varchar('avatar', { length: 50 }).notNull(),
  systemPrompt: text('system_prompt').notNull(),
  greeting: text('greeting').notNull().default('Hello! How can I help you?'),
  roomPlacementId: uuid('room_placement_id').references(() => roomPlacements.id),
  spawnX: integer('spawn_x'),
  spawnY: integer('spawn_y'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// NPC Knowledge Sources
export const npcKnowledgeSources = pgTable('npc_knowledge_sources', {
  id: uuid('id').defaultRandom().primaryKey(),
  npcId: uuid('npc_id').references(() => npcAgents.id).notNull(),
  sourceType: varchar('source_type', { length: 50 }).notNull(),
  sourcePath: text('source_path').notNull(),
  lastSyncedAt: timestamp('last_synced_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// NPC MCP Connections
export const npcMcpConnections = pgTable('npc_mcp_connections', {
  id: uuid('id').defaultRandom().primaryKey(),
  npcId: uuid('npc_id').references(() => npcAgents.id).notNull(),
  mcpServerUrl: text('mcp_server_url').notNull(),
  mcpServerName: varchar('mcp_server_name', { length: 100 }).notNull(),
  authConfig: jsonb('auth_config').default({}),
  isActive: boolean('is_active').notNull().default(true),
})

// NPC Tool Permissions
export const npcToolPermissions = pgTable('npc_tool_permissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  mcpConnectionId: uuid('mcp_connection_id').references(() => npcMcpConnections.id).notNull(),
  toolName: varchar('tool_name', { length: 100 }).notNull(),
  isAllowed: boolean('is_allowed').notNull().default(false),
})

// NPC Embeddings (pgvector)
export const npcEmbeddings = pgTable('npc_embeddings', {
  id: uuid('id').defaultRandom().primaryKey(),
  npcId: uuid('npc_id').references(() => npcAgents.id).notNull(),
  sourceId: uuid('source_id').references(() => npcKnowledgeSources.id).notNull(),
  chunkText: text('chunk_text').notNull(),
  embedding: vector('embedding', { dimensions: 1024 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Player Stats
export const playerStats = pgTable('player_stats', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull().unique(),
  hp: integer('hp').notNull().default(100),
  maxHp: integer('max_hp').notNull().default(100),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Office Settings
export const officeSettings = pgTable('office_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  key: varchar('key', { length: 100 }).notNull().unique(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
