# Database Schema & Authentication

Date: 2026-04-10
Series: Design Documents 2 of 7

---

## Auth Flow

1. **First boot**: Database is empty. Server seeds an admin account (`admin` / `changeme`) and sets a `force_password_change` flag. Admin is redirected to a change-password screen on first login.
2. **User provisioning**: Admin creates user accounts via the admin panel. No self-registration. Invite-based only (admin sets username + temporary password, user changes on first login).
3. **Login**: `POST /auth/login` with `{ username, password }`. Server bcrypt-verifies the password hash. Returns a signed JWT on success.
4. **Token usage**: Client stores JWT in memory (not localStorage). Sends it as `Authorization: Bearer <token>` for all REST calls. Also passed as the Colyseus auth token on `room.connect()`.
5. **Colyseus auth**: `onAuth` hook on each room verifies the JWT signature and expiry before allowing the client to join. Rejects with 401 if invalid.
6. **Future**: Add OAuth/SSO provider support (Google Workspace, GitHub, etc.) via Passport.js strategy layer. JWT issuance path stays the same — only the credential verification step changes.

---

## Database Schema

### Auth

```sql
CREATE TYPE user_role AS ENUM ('admin', 'member');

CREATE TABLE users (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username              VARCHAR(64) NOT NULL UNIQUE,
  password_hash         TEXT NOT NULL,
  display_name          VARCHAR(128) NOT NULL,
  avatar                VARCHAR(64) NOT NULL DEFAULT 'adam',
  role                  user_role NOT NULL DEFAULT 'member',
  nexfina_token         TEXT NULL,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  force_password_change BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at         TIMESTAMPTZ NULL
);
```

- `avatar` stores the sprite key name (e.g., `adam`, `ash`, `lucy`). Defaults to `adam` to match the SkyOffice base.
- `nexfina_token` is nullable — only populated when a user explicitly links their NexFina account.
- `force_password_change` is set `true` on seeded/invite-created accounts and cleared after the user sets their own password.

---

### Office Map

```sql
CREATE TABLE office_layout (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grid_width   INT NOT NULL DEFAULT 5,
  grid_height  INT NOT NULL DEFAULT 4,
  created_by   UUID NOT NULL REFERENCES users(id),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE room_templates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(128) NOT NULL,
  slug             VARCHAR(64) NOT NULL UNIQUE,
  width_blocks     INT NOT NULL DEFAULT 1,
  height_blocks    INT NOT NULL DEFAULT 1,
  tile_data        JSONB NOT NULL,
  item_slots       JSONB NOT NULL DEFAULT '[]',
  npc_spawn_points JSONB NOT NULL DEFAULT '[]',
  features         JSONB NOT NULL DEFAULT '{}',
  is_builtin       BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE room_placements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_id   UUID NOT NULL REFERENCES office_layout(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES room_templates(id),
  grid_x      INT NOT NULL,
  grid_y      INT NOT NULL,
  room_name   VARCHAR(128) NOT NULL,
  UNIQUE (layout_id, grid_x, grid_y)
);
```

- `tile_data`: Tiled-format JSON for the template's tile layers. Stored in DB so templates can be bundled without a filesystem dependency.
- `item_slots`: Array of `{ type, x, y, label }` objects describing interactive items (chairs, computers, whiteboards).
- `npc_spawn_points`: Array of `{ x, y, label }` tile coordinates where NPCs may be placed.
- `features`: Object with boolean flags — `{ voice, screenshare, whiteboard, privateChat }`.
- The `UNIQUE (layout_id, grid_x, grid_y)` constraint prevents overlapping placements.

---

### Chat

```sql
CREATE TYPE channel_type AS ENUM ('public', 'room', 'dm');

CREATE TABLE chat_channels (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type       channel_type NOT NULL,
  room_id    UUID NULL REFERENCES room_placements(id) ON DELETE CASCADE,
  name       VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE chat_channel_members (
  channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, user_id)
);

CREATE TYPE sender_type AS ENUM ('user', 'npc', 'system');

CREATE TABLE chat_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id  UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  sender_id   UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  sender_type sender_type NOT NULL DEFAULT 'user',
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- `room_id` is NULL for `public` and `dm` channel types; set for `room`-scoped channels.
- `sender_id` is NULL for `system` messages (server-generated). For `npc` messages the sender_id references the NPC's agent row — NPC agents are stored in `npc_agents`, not `users`, so application code must check `sender_type` before joining.
- `chat_channel_members` tracks who is currently in a channel. Room channels update membership on zone enter/leave events.

---

### Tasks

```sql
CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'done');

CREATE TABLE tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       VARCHAR(256) NOT NULL,
  description TEXT NULL,
  status      task_status NOT NULL DEFAULT 'todo',
  assigned_to UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  created_by  UUID NOT NULL REFERENCES users(id),
  due_date    DATE NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE daily_schedules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  label       VARCHAR(128) NOT NULL
);
```

- `assigned_to` is nullable — unassigned tasks are visible to all members, assigned tasks show in the assignee's personal view.
- `day_of_week`: 0 = Sunday, 6 = Saturday (matches JavaScript `Date.getDay()`).
- `daily_schedules` is used to display each user's working hours on their profile card in the office.

---

### NPC / AI

```sql
CREATE TYPE agent_type AS ENUM ('agent', 'ghost');

CREATE TABLE npc_agents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(128) NOT NULL,
  avatar        VARCHAR(64) NOT NULL,
  personality   TEXT NOT NULL DEFAULT '',
  agent_type    agent_type NOT NULL DEFAULT 'ghost',
  spawn_room_id UUID NULL REFERENCES room_placements(id) ON DELETE SET NULL,
  spawn_x       INT NOT NULL DEFAULT 0,
  spawn_y       INT NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE knowledge_source_type AS ENUM ('document', 'obsidian', 'url');

CREATE TABLE npc_knowledge_sources (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  npc_id         UUID NOT NULL REFERENCES npc_agents(id) ON DELETE CASCADE,
  source_type    knowledge_source_type NOT NULL,
  source_path    TEXT NOT NULL,
  last_indexed_at TIMESTAMPTZ NULL
);

CREATE TABLE npc_mcp_connections (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  npc_id         UUID NOT NULL REFERENCES npc_agents(id) ON DELETE CASCADE,
  mcp_server_url TEXT NOT NULL,
  description    TEXT NOT NULL DEFAULT '',
  enabled        BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE npc_tool_permissions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  npc_id            UUID NOT NULL REFERENCES npc_agents(id) ON DELETE CASCADE,
  mcp_connection_id UUID NOT NULL REFERENCES npc_mcp_connections(id) ON DELETE CASCADE,
  tool_name         VARCHAR(256) NOT NULL,
  allowed           BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE npc_embeddings (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  npc_id    UUID NOT NULL REFERENCES npc_agents(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES npc_knowledge_sources(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  embedding  VECTOR(1536) NOT NULL,
  metadata   JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX ON npc_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

- `agent_type = 'ghost'`: read-only knowledge base, no MCP tool execution. Safer for general-purpose assistants.
- `agent_type = 'agent'`: can execute tools via configured MCP connections (subject to `npc_tool_permissions`).
- `spawn_room_id NULL` means the NPC roams the lobby/public area.
- `npc_tool_permissions.allowed DEFAULT false`: tools must be explicitly whitelisted; deny-by-default.
- The IVFFlat index on `npc_embeddings.embedding` enables efficient approximate nearest-neighbor search for RAG retrieval. `lists = 100` is a starting value; tune based on embedding count.

---

### Gamification

```sql
CREATE TABLE player_stats (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  hp           INT NOT NULL DEFAULT 100,
  max_hp       INT NOT NULL DEFAULT 100,
  last_reset_at DATE NOT NULL DEFAULT CURRENT_DATE
);
```

- One row per user (`UNIQUE` on `user_id`).
- `last_reset_at` tracks the last daily reset date. The server checks this on connection and resets `hp` to `max_hp` if `last_reset_at < CURRENT_DATE`.

---

## NexFina Account Linking

NexVOffice and NexFina are separate products with separate auth systems. Linking is voluntary and user-initiated.

**Linking flow:**
1. User visits their profile settings in NexVOffice.
2. They paste a NexFina API token (generated from the NexFina dashboard).
3. NexVOffice stores the token in `users.nexfina_token` (encrypted at rest).
4. The token is validated against the NexFina API before saving.

**How it is used:**
- When a user sends a message to an NPC agent, the server checks if the user has a linked NexFina token.
- If yes, and the NPC's MCP connection requires user-scoped auth, the user's token is forwarded with the MCP call.
- If no linked token, the NPC falls back to RAG-only responses (no user-scoped tool execution).

**What it does NOT affect:**
- NexVOffice login — always uses the local JWT system.
- NPC ghost-type agents — they never execute tools regardless of token.
- RAG knowledge queries — always available to all users.
