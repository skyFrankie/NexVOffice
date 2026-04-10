# NexVOffice Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform SkyOffice fork into NexVOffice — a self-hosted virtual office with auth, AI NPCs, meeting rooms, chat, tasks, and gamification.

**Architecture:** Foundation-first approach. Decouple client (service layer), add Postgres + auth, then build features on clean module boundaries. Single-tenant, single Docker Compose deployment on EC2.

**Tech Stack:** Phaser3, Colyseus, React, Redux, TypeScript, Express, PostgreSQL + pgvector, AWS Bedrock (Nova Pro), PeerJS, Coturn, Vite, Docker Compose.

**Reference designs:** `docs/plans/2026-04-10-01-*.md` through `2026-04-10-07-*.md`

---

## Phase Overview

| Phase | Name | Depends On | Estimated Tasks |
|-------|------|-----------|-----------------|
| 0 | Foundation & Client Refactoring | — | 12 |
| 1 | Database & Auth | Phase 0 | 10 |
| 2 | Map & Room System | Phase 1 | 11 |
| 3 | Chat System | Phase 2 | 10 |
| 4 | Meeting Room Collaboration | Phase 3 | 9 |
| 5 | AI NPC Engine | Phase 1 (+Phase 2 for NPC room placement) | 12 |
| 6 | Gamification & Tasks | Phase 1 | 8 |
| 7 | Admin Panel & Polish | Phase 2-6 | 8 |

Phases 5 and 6 can run **in parallel** after Phase 1 completes.

---

## Phase 0: Foundation & Client Refactoring

**Goal:** Decouple React ↔ Phaser ↔ Redux, introduce service layer, restructure directories.

**Reference:** `docs/plans/2026-04-10-06-client-refactoring.md`

### Task 0.1: Restructure Client Directories

**Files:**
- Create: `client/src/services/` directory
- Create: `client/src/hooks/` directory
- Create: `client/src/components/auth/` directory
- Create: `client/src/components/admin/` directory
- Create: `client/src/components/chat/` directory
- Create: `client/src/components/tasks/` directory
- Create: `client/src/components/game/` directory

**Step 1:** Create the new directory structure with placeholder `index.ts` files.

**Step 2:** Commit.

```bash
git add client/src/services/ client/src/hooks/ client/src/components/
git commit -m "chore: scaffold new client directory structure"
```

---

### Task 0.2: Create EventCenter Expanded Events

**Files:**
- Modify: `client/src/events/EventCenter.ts`

**Step 1:** Add new event types to the Event enum:

```typescript
export enum Event {
  // Existing
  MY_PLAYER_NAME_CHANGE = 'my-player-name-change',
  MY_PLAYER_TEXTURE_CHANGE = 'my-player-texture-change',
  MY_PLAYER_READY = 'my-player-ready',
  MY_PLAYER_VIDEO_CONNECTED = 'my-player-video-connected',
  PLAYER_JOINED = 'player-joined',
  PLAYER_LEFT = 'player-left',
  PLAYER_UPDATED = 'player-updated',
  ITEM_USER_ADDED = 'item-user-added',
  ITEM_USER_REMOVED = 'item-user-removed',
  UPDATE_DIALOG_BUBBLE = 'update-dialog-bubble',
  PLAYER_DISCONNECTED = 'player-disconnected',

  // NEW — keyboard control
  DISABLE_KEYS = 'disable-keys',
  ENABLE_KEYS = 'enable-keys',

  // NEW — zone
  ENTER_ZONE = 'enter-zone',
  LEAVE_ZONE = 'leave-zone',

  // NEW — NPC
  NPC_INTERACTION_START = 'npc-interaction-start',
  NPC_INTERACTION_END = 'npc-interaction-end',
  NPC_RESPONSE = 'npc-response',

  // NEW — proximity chat
  PROXIMITY_CHAT_START = 'proximity-chat-start',

  // NEW — gamification
  PLAYER_BEAT = 'player-beat',
  HP_UPDATE = 'hp-update',
}
```

**Step 2:** Commit.

```bash
git add client/src/events/EventCenter.ts
git commit -m "feat: expand EventCenter with zone, NPC, chat, and gamification events"
```

---

### Task 0.3: Decouple ChatStore from Phaser

**Files:**
- Modify: `client/src/stores/ChatStore.ts`
- Modify: `client/src/scenes/Game.ts`

**Step 1:** Remove Phaser access from ChatStore reducer. The `setFocused` reducer should be a pure state update only:

```typescript
// ChatStore.ts — REMOVE the phaserGame import and direct scene access
// setFocused reducer becomes:
setFocused: (state, action: PayloadAction<boolean>) => {
  state.focused = action.payload
}
```

**Step 2:** In `Game.ts`, listen for the Redux state change via the EventCenter:

```typescript
// In Game.ts create() method, add:
import store from '../stores'

store.subscribe(() => {
  const focused = store.getState().chat.focused
  if (focused) {
    this.disableKeys()
  } else {
    this.enableKeys()
  }
})
```

**Step 3:** Verify chat still works — typing in chat box should disable WASD movement, closing should re-enable.

**Step 4:** Commit.

```bash
git add client/src/stores/ChatStore.ts client/src/scenes/Game.ts
git commit -m "refactor: decouple ChatStore from Phaser scene access"
```

---

### Task 0.4: Decouple ComputerStore from Phaser

**Files:**
- Modify: `client/src/stores/ComputerStore.ts`
- Modify: `client/src/scenes/Game.ts`

**Step 1:** Remove Phaser access from ComputerStore. Same pattern as Task 0.3 — make `openComputerDialog` and `closeComputerDialog` pure state updates.

**Step 2:** Move the keyboard disable/enable logic to the Game.ts store subscription (extend the one from Task 0.3 to also watch `computer.computerDialogOpen`). Also move the `game.network.disconnectFromComputer()` call from the `closeComputerDialog` reducer to the NetworkService or a store subscription bridge.

**Step 3:** Commit.

```bash
git add client/src/stores/ComputerStore.ts client/src/scenes/Game.ts
git commit -m "refactor: decouple ComputerStore from Phaser scene access"
```

---

### Task 0.5: Decouple WhiteboardStore from Phaser

**Files:**
- Modify: `client/src/stores/WhiteboardStore.ts`
- Modify: `client/src/scenes/Game.ts`

**Step 1:** Same pattern — pure reducer, move keyboard control to Game.ts subscription. Also move the `game.network.disconnectFromWhiteboard()` call from the `closeWhiteboardDialog` reducer to the NetworkService or a store subscription bridge.

**Step 2:** Commit.

```bash
git add client/src/stores/WhiteboardStore.ts client/src/scenes/Game.ts
git commit -m "refactor: decouple WhiteboardStore from Phaser scene access"
```

---

### Task 0.6: Decouple UserStore from Phaser

**Files:**
- Modify: `client/src/stores/UserStore.ts`
- Modify: `client/src/scenes/Game.ts` or `client/src/scenes/Bootstrap.ts`

**Step 1:** Remove the Bootstrap scene access from `toggleBackgroundMode`. Make it a pure state update. Listen for changes in Bootstrap scene via store subscription.

**Step 2:** Commit.

```bash
git add client/src/stores/UserStore.ts client/src/scenes/Bootstrap.ts
git commit -m "refactor: decouple UserStore from Phaser scene access"
```

---

### Task 0.7: Create NetworkService

**Files:**
- Create: `client/src/services/NetworkService.ts`
- Modify: `client/src/services/Network.ts` → rename conceptually, NetworkService wraps it

**Step 1:** Create `NetworkService.ts` as a singleton that wraps the existing Network class and exposes typed methods. This is the single point of contact for all Colyseus communication.

```typescript
// client/src/services/NetworkService.ts
import Network from './Network'

class NetworkService {
  private network!: Network

  setNetwork(network: Network) {
    this.network = network
  }

  getNetwork(): Network {
    return this.network
  }

  // Typed convenience methods
  sendChatMessage(content: string) {
    this.network.addChatMessage(content)
  }

  connectToComputer(id: string) {
    this.network.connectToComputer(id)
  }

  disconnectFromComputer(id: string) {
    this.network.disconnectFromComputer(id)
  }

  // ... wrap all Network methods
}

export const networkService = new NetworkService()
export default networkService
```

**Step 2:** Initialize it in Bootstrap.ts when Network is created.

**Step 3:** Commit.

```bash
git add client/src/services/NetworkService.ts client/src/scenes/Bootstrap.ts
git commit -m "feat: create NetworkService singleton as client service layer entry point"
```

---

### Task 0.8: Create ChatService

**Files:**
- Create: `client/src/services/ChatService.ts`

**Step 1:** Create ChatService that mediates between React, Redux, Colyseus, and Phaser for all chat operations:

```typescript
// client/src/services/ChatService.ts
import networkService from './NetworkService'
import store from '../stores'
import { pushChatMessage } from '../stores/ChatStore'
import { phaserEvents, Event } from '../events/EventCenter'

class ChatService {
  sendPublicMessage(content: string) {
    networkService.sendChatMessage(content)
    phaserEvents.emit(Event.UPDATE_DIALOG_BUBBLE, store.getState().user.sessionId, content)
  }
}

export const chatService = new ChatService()
export default chatService
```

**Step 2:** Refactor `Chat.tsx` to use `chatService.sendPublicMessage()` instead of directly accessing `game.network.addChatMessage()` and `game.myPlayer.updateDialogBubble()`.

**Step 3:** Commit.

```bash
git add client/src/services/ChatService.ts client/src/components/Chat.tsx
git commit -m "feat: create ChatService, refactor Chat.tsx to use service layer"
```

---

### Task 0.9: Refactor React Components to Use Services

**Files:**
- Modify: `client/src/components/LoginDialog.tsx` (or new `LoginPage.tsx`)
- Modify: `client/src/components/RoomSelectionDialog.tsx`
- Modify: `client/src/components/CreateRoomForm.tsx`
- Modify: `client/src/components/CustomRoomTable.tsx`
- Modify: `client/src/components/MobileVirtualJoystick.tsx`

**Step 1:** For each component, replace direct `phaserGame.scene.keys.game` access with service calls or Phaser events. The goal: no React component imports `PhaserGame.ts` directly.

**Step 2:** Commit per component or batch if small.

```bash
git commit -m "refactor: remove direct Phaser access from React components"
```

---

### Task 0.10: Expand Shared Types

**Files:**
- Modify: `types/Messages.ts`
- Modify: `types/Items.ts`
- Modify: `types/PlayerBehavior.ts`

**Step 1:** Add new message types:

```typescript
// types/Messages.ts
export enum Message {
  // Existing
  UPDATE_PLAYER = 0,
  UPDATE_PLAYER_NAME,
  READY_TO_CONNECT,
  DISCONNECT_STREAM,
  CONNECT_TO_COMPUTER,
  DISCONNECT_FROM_COMPUTER,
  STOP_SCREEN_SHARE,
  CONNECT_TO_WHITEBOARD,
  DISCONNECT_FROM_WHITEBOARD,
  VIDEO_CONNECTED,
  ADD_CHAT_MESSAGE,
  SEND_ROOM_DATA,

  // NEW — Chat
  SEND_DM,
  SEND_ROOM_MESSAGE,
  MENTION_NPC,
  START_PROXIMITY_CHAT,
  PROXIMITY_CHAT_OPENED,

  // NEW — Zones
  ENTER_ZONE,
  LEAVE_ZONE,
  JOIN_VOICE,
  LEAVE_VOICE,

  // NEW — NPC
  START_NPC_CONVERSATION,
  NPC_MESSAGE,
  NPC_RESPONSE,
  END_NPC_CONVERSATION,

  // NEW — Gamification
  BEAT_PLAYER,
  HP_UPDATE,

  // NEW — Tasks
  TASK_ASSIGNED,
  TASK_UPDATED,
}
```

**Step 2:** Add NPC to ItemType:

```typescript
// types/Items.ts
export enum ItemType {
  CHAIR,
  COMPUTER,
  WHITEBOARD,
  VENDINGMACHINE,
  NPC, // NEW
}
```

**Step 3:** Add new player behaviors:

```typescript
// types/PlayerBehavior.ts
export enum PlayerBehavior {
  IDLE,
  SITTING,
  TALKING_TO_NPC, // NEW
}
```

**Step 4:** Commit.

```bash
git add types/
git commit -m "feat: expand shared types with new message types, NPC item, and behaviors"
```

---

### Task 0.11: Update Server Message Types

**Files:**
- Modify: `server/rooms/SkyOffice.ts`

**Step 1:** Import the new message types. Add placeholder `onMessage` handlers for the new types (empty handlers that log for now — actual implementation comes in later phases).

**Step 2:** Commit.

```bash
git add server/rooms/SkyOffice.ts
git commit -m "feat: register placeholder handlers for new message types"
```

---

### Task 0.12: Verify & Integration Test

**Step 1:** Run the client dev build to verify no TypeScript errors:

```bash
cd client && npx tsc --noEmit
```

**Step 2:** Run the server build:

```bash
cd server && npx tsc --project tsconfig.server.json --noEmit
```

**Step 3:** Docker build to verify everything compiles:

```bash
docker compose build
```

**Step 4:** Commit any fixes.

```bash
git commit -m "fix: resolve build issues from Phase 0 refactoring"
```

---

### Task 0.13: Add Vitest Setup

Files:
- Create: `client/vitest.config.ts`
- Create: `client/src/services/__tests__/` directory
- Modify: `client/package.json` (add vitest dev dependency)

Step 1: Install vitest and configure for React/TypeScript.

Step 2: Create a sample test file to verify setup works.

Step 3: Commit.

```bash
git commit -m "chore: add vitest test infrastructure"
```

---

## Phase 1: Database & Auth

**Goal:** Add PostgreSQL, user accounts, JWT auth, seed admin.

**Reference:** `docs/plans/2026-04-10-02-database-auth.md`

### Task 1.1: Add PostgreSQL to Docker Compose

**Files:**
- Modify: `docker-compose.yml`
- Create: `server/db/connection.ts`
- Modify: `package.json` (add `pg`, `drizzle-orm`, `drizzle-kit` dependencies)

**Step 1:** Add postgres service to docker-compose.yml:

```yaml
postgres:
  image: pgvector/pgvector:pg16
  restart: unless-stopped
  environment:
    POSTGRES_DB: nexvoffice
    POSTGRES_USER: nexvoffice
    POSTGRES_PASSWORD: ${DB_PASSWORD:-nexvoffice_dev}
  volumes:
    - pgdata:/var/lib/postgresql/data
  expose:
    - "5432"

volumes:
  pgdata:
```

**Step 2:** Add `pg` and `drizzle-orm` to server dependencies.

**Step 3:** Create `server/db/connection.ts` with a Postgres pool connection.

**Step 4:** Create `server/config.ts` for environment variable management.

**Step 5:** Commit.

```bash
git commit -m "feat: add PostgreSQL to Docker Compose, create DB connection module"
```

---

### Task 1.2: Create Database Schema & Migrations

**Files:**
- Create: `server/db/schema.ts` (Drizzle schema definitions)
- Create: `server/db/migrations/` directory

**Step 1:** Define all tables from design doc 02 using Drizzle ORM schema.

**Step 2:** Generate migration with `drizzle-kit generate`.

**Step 3:** Create migration runner that runs on server boot.

**Step 4:** Commit.

```bash
git commit -m "feat: define database schema and initial migration"
```

---

### Task 1.3: Seed Admin Account

**Files:**
- Create: `server/db/seed.ts`

**Step 1:** On first boot (users table empty), create admin account:
- username: `admin`
- password: bcrypt hash of `changeme`
- role: `admin`
- display_name: `Admin`
- avatar: `adam`

**Step 2:** Add flag/field for `must_change_password` so first login forces password change.

**Step 3:** Call seed from server startup after migrations.

**Step 4:** Commit.

```bash
git commit -m "feat: seed admin account on first boot"
```

---

### Task 1.4: Auth Routes — Login

**Files:**
- Create: `server/auth/service.ts`
- Create: `server/auth/routes.ts`
- Create: `server/auth/middleware.ts`

**Step 1:** Create auth service with `login(username, password)` → JWT token, `verifyToken(token)` → user payload.

**Step 2:** Create Express routes:
- `POST /auth/login` — returns JWT
- `POST /auth/change-password` — for first-boot password change

**Step 3:** Create JWT middleware for protecting REST routes.

**Step 4:** Commit.

```bash
git commit -m "feat: add JWT auth service and login route"
```

---

### Task 1.5: Auth Routes — User Management (Admin)

**Files:**
- Create: `server/api/users.ts`

**Step 1:** Create admin-only routes:
- `POST /api/users` — create new user (admin only)
- `GET /api/users` — list all users
- `PUT /api/users/:id` — update user (admin: any user, member: self only)
- `DELETE /api/users/:id` — deactivate user (admin only)

**Step 2:** Add auth middleware to protect routes.

**Step 3:** Commit.

```bash
git commit -m "feat: add user management REST API"
```

---

### Task 1.6: Colyseus Auth Integration

**Files:**
- Modify: `server/rooms/SkyOffice.ts`

**Step 1:** Update `onAuth` to verify JWT token instead of just room password:

```typescript
async onAuth(client: Client, options: any) {
  const token = options.token
  if (!token) throw new ServerError(401, 'No token provided')
  const user = await authService.verifyToken(token)
  if (!user) throw new ServerError(401, 'Invalid token')
  return user // attached to client.auth
}
```

**Step 2:** Update `onJoin` to use `client.auth` for player name, avatar.

**Step 3:** Commit.

```bash
git commit -m "feat: integrate JWT auth into Colyseus room join"
```

---

### Task 1.7: Client Auth Store

**Files:**
- Create: `client/src/stores/authStore.ts`
- Create: `client/src/hooks/useAuth.ts`

**Step 1:** Create authStore with: user, token, isAuthenticated, isAdmin, login(), logout().

**Step 2:** Create useAuth hook that wraps the store.

**Step 3:** Persist token in localStorage (for POC — survives page refresh). Note: for production, consider httpOnly cookies with CSRF protection.

**Step 4:** Commit.

```bash
git commit -m "feat: add client auth store and useAuth hook"
```

---

### Task 1.8: Login Page UI

**Files:**
- Create: `client/src/components/auth/LoginPage.tsx`
- Modify: `client/src/App.tsx`

**Step 1:** Create LoginPage with username/password form, error handling, first-boot password change flow.

**Step 2:** Update App.tsx routing: if not authenticated → LoginPage, if authenticated → game.

**Step 3:** Remove RoomSelectionDialog from the flow (single office per deployment).

**Step 4:** Commit.

```bash
git commit -m "feat: add login page, update App.tsx auth routing"
```

---

### Task 1.9: Client Network Auth

**Files:**
- Modify: `client/src/services/Network.ts`

**Step 1:** Pass JWT token when connecting to Colyseus:

```typescript
this.client = new Client(endpoint)
// When joining rooms, pass token:
this.room = await this.client.joinOrCreate(RoomType.PUBLIC, { token: authStore.token })
```

**Step 2:** Handle auth errors (redirect to login on 401).

**Step 3:** Commit.

```bash
git commit -m "feat: pass JWT token in Colyseus room join"
```

---

### Task 1.10: Phase 1 Verification

**Step 1:** Docker compose up — verify Postgres starts, migrations run, admin seed works.

**Step 2:** Test login flow: open browser → see login page → login as admin → forced password change → enter office.

**Step 3:** Test user management: admin creates a user → new user can login.

**Step 4:** Commit any fixes.

```bash
git commit -m "fix: Phase 1 verification fixes"
```

---

## Phase 2: Map & Room System

**Goal:** Data-driven maps from template blocks, zone detection, room-scoped features.

**Note:** The v1 stitcher assumes all built-in templates share identical tileset definitions. No GID remapping is needed. Custom template support is deferred to v2.

**Reference:** `docs/plans/2026-04-10-03-map-room-system.md`

### Task 2.1: Create Room Template Data Structure

**Files:**
- Create: `server/map/templates.ts`
- Create: `server/db/seed-templates.ts`

**Step 1:** Define the TypeScript interface for room templates matching the DB schema.

**Step 2:** Create seed data for built-in templates: Meeting Room S/M/L, Open Desk, Break Room, NPC Office, Lobby, Hallway H/V. Use the existing Tiled map data as a starting point for tile_data.

**Step 3:** Seed templates on first boot (alongside admin seed).

**Step 4:** Commit.

```bash
git commit -m "feat: define room templates and seed built-in templates"
```

---

### Task 2.2: Create Map Stitcher

**Files:**
- Create: `server/map/stitcher.ts`
- Create: `server/map/zones.ts`

**Step 1:** Implement `stitchMap(placements, templates)`:
- Takes room_placements + their templates
- Combines tile_data into a single Phaser-compatible tilemap JSON
- Calculates total map dimensions from grid positions + template sizes
- Merges tile layers, object layers
- Auto-generates wall tiles between rooms
- Adds doorway openings at adjacent room edges

**Step 2:** Implement `calculateZones(placements, templates)`:
- Returns array of RoomZone objects with pixel-coordinate bounds
- Each zone: roomId, roomName, bounds {x, y, width, height}, features

**Step 3:** Commit.

```bash
git commit -m "feat: implement map stitcher and zone calculator"
```

---

### Task 2.3: Map API Endpoint

**Files:**
- Create: `server/api/admin.ts` (partial — map-related routes)

**Step 1:** Create endpoints:
- `GET /api/map` — returns stitched tilemap JSON + zones array
- `GET /api/map/templates` — list available templates
- `POST /api/admin/layout` — save office layout (admin only)
- `GET /api/admin/layout` — get current layout with placements

**Step 2:** Commit.

```bash
git commit -m "feat: add map and layout REST API endpoints"
```

---

### Task 2.4: Default Office Layout Seed

**Files:**
- Modify: `server/db/seed.ts`

**Step 1:** Create a default office layout with initial room placements:
- 1 Lobby
- 1 Open Desk Area
- 1 Meeting Room S
- 1 Break Room
- Connected by hallways

This gives a working office out of the box.

**Step 2:** Commit.

```bash
git commit -m "feat: seed default office layout"
```

---

### Task 2.5: Refactor Bootstrap.ts for Dynamic Map Loading

**Files:**
- Modify: `client/src/scenes/Bootstrap.ts`

**Step 1:** Instead of hard-coded asset paths, fetch map config from `GET /api/map` and load assets dynamically. The tilemap JSON comes from the stitcher, not a static file.

**Step 2:** Keep existing character sprite loading (still static assets for now).

**Step 3:** Commit.

```bash
git commit -m "refactor: Bootstrap loads map dynamically from API"
```

---

### Task 2.6: Refactor Game.ts for Data-Driven Items

**Files:**
- Modify: `client/src/scenes/Game.ts`

**Step 1:** Instead of hard-coded item placement, read item positions from the map data (item_slots from templates). Create items dynamically based on what the map contains.

**Step 2:** Remove hard-coded computer/whiteboard counts. Item IDs come from the map data.

**Step 3:** Commit.

```bash
git commit -m "refactor: Game.ts creates items dynamically from map data"
```

---

### Task 2.7: Refactor Server Room for Data-Driven Items

**Files:**
- Modify: `server/rooms/SkyOffice.ts`

**Step 1:** In `onCreate`, read item counts from the map/layout instead of hard-coding 5 computers and 3 whiteboards. Create Computer/Whiteboard schema objects based on map data.

**Step 2:** Commit.

```bash
git commit -m "refactor: server creates room items from map data"
```

---

### Task 2.8: Zone Detection — Server Side

**Files:**
- Modify: `server/rooms/SkyOffice.ts`
- Create: `server/rooms/schema/RoomZone.ts`

**Step 1:** Add zone data to room state. On player position update, check if player entered/left a zone. Send ENTER_ZONE / LEAVE_ZONE messages.

**Step 2:** Commit.

```bash
git commit -m "feat: server-side zone detection on player movement"
```

---

### Task 2.9: Zone Detection — Client Side

**Files:**
- Modify: `client/src/scenes/Game.ts`
- Create: `client/src/components/game/RoomIndicator.tsx`

**Step 1:** Client checks zone boundaries locally for instant feedback. On ENTER_ZONE message from server, show RoomIndicator ("You are in: Meeting Room A").

**Step 2:** Store current zone in roomStore.

**Step 3:** Commit.

```bash
git commit -m "feat: client zone detection and RoomIndicator UI"
```

---

### Task 2.10: Configurable Spawn Position

**Files:**
- Modify: `server/rooms/schema/OfficeState.ts`
- Modify: `client/src/scenes/Game.ts`

**Step 1:** Read spawn position from the Lobby template instead of hard-coded (705, 500). Server sends spawn position in room data.

**Step 2:** Commit.

```bash
git commit -m "refactor: configurable spawn position from map data"
```

---

### Task 2.11: Phase 2 Verification

**Step 1:** Docker build + run. Verify default office loads with correct rooms.

**Step 2:** Walk between rooms — verify zone detection fires, RoomIndicator shows/hides.

**Step 3:** Verify items appear in correct positions per template.

**Step 4:** Commit any fixes.

```bash
git commit -m "fix: Phase 2 verification fixes"
```

---

## Phase 3: Chat System

**Goal:** Public chat, room-scoped chat, DMs (proximity + roster), chat persistence.

**Reference:** `docs/plans/2026-04-10-04-chat-communication.md`

### Task 3.1: Chat Channel API

**Files:**
- Create: `server/api/chat.ts`

**Step 1:** Create REST endpoints:
- `GET /api/channels` — list user's channels (public, room, DMs)
- `GET /api/channels/:id/messages` — paginated message history
- `POST /api/channels/dm` — create/find DM channel between two users

**Step 2:** Auto-create the public channel on first boot (in seed).

**Step 3:** Commit.

```bash
git commit -m "feat: chat channel REST API with message history"
```

---

### Task 3.2: Persist Chat Messages

**Files:**
- Modify: `server/rooms/commands/ChatMessageUpdateCommand.ts`

**Step 1:** When a chat message is dispatched, also write it to the `chat_messages` table with the appropriate channel_id.

**Step 2:** Public messages go to the public channel. Room messages go to the room's channel.

**Step 3:** Commit.

```bash
git commit -m "feat: persist chat messages to database"
```

---

### Task 3.3: Room Chat — Auto Join/Leave

**Files:**
- Modify: `server/rooms/SkyOffice.ts`

**Step 1:** When ENTER_ZONE fires, add player to the room's chat_channel_members. When LEAVE_ZONE fires, remove them.

**Step 2:** Auto-create a chat_channel for each room_placement (type='room') during seed/layout save.

**Step 3:** Send recent room messages to the player on zone enter.

**Step 4:** Commit.

```bash
git commit -m "feat: auto join/leave room chat channels on zone detection"
```

---

### Task 3.4: Refactor ChatPanel with Tabs

**Files:**
- Create: `client/src/components/chat/ChatPanel.tsx`
- Modify: `client/src/stores/chatStore.ts`

**Step 1:** Replace the existing `Chat.tsx` with a new `ChatPanel.tsx` that has tabs: Public | Room (when in a room) | DMs.

**Step 2:** Refactor chatStore to support multiple channels with separate message arrays.

**Step 3:** Commit.

```bash
git commit -m "feat: tabbed ChatPanel with public, room, and DM tabs"
```

---

### Task 3.5: DM — Roster Panel

**Files:**
- Create: `client/src/components/chat/DMList.tsx`

**Step 1:** Create DMList showing all online players. Click a player → opens DM conversation (creates DM channel via API if needed).

**Step 2:** Show unread message indicator.

**Step 3:** Commit.

```bash
git commit -m "feat: DM roster panel with online player list"
```

---

### Task 3.6: DM — Server Handlers

**Files:**
- Modify: `server/rooms/SkyOffice.ts`

**Step 1:** Handle SEND_DM message: find/create DM channel, save to DB, forward to target player's client.

**Step 2:** Handle START_PROXIMITY_CHAT: same as SEND_DM but also sends PROXIMITY_CHAT_OPENED to both clients.

**Step 3:** Commit.

```bash
git commit -m "feat: server-side DM and proximity chat message handlers"
```

---

### Task 3.7: Proximity Quick Chat — Client

**Files:**
- Modify: `client/src/characters/OtherPlayer.ts`
- Create: `client/src/components/chat/ProximityBubble.tsx`

**Step 1:** When OtherPlayer overlap is detected, show "Press R to chat with [name]" (instead of WebRTC call).

**Step 2:** Create ProximityBubble.tsx — floating DM window anchored near characters. Auto-minimizes after 30s out of range.

**Step 3:** Commit.

```bash
git commit -m "feat: proximity quick chat with floating DM bubble"
```

---

### Task 3.8: Room Chat Messages — Server

**Files:**
- Modify: `server/rooms/SkyOffice.ts`

**Step 1:** Handle SEND_ROOM_MESSAGE: save to room's channel, broadcast to all players in that zone only.

**Step 2:** Commit.

```bash
git commit -m "feat: room-scoped chat message handling"
```

---

### Task 3.9: Chat Service Integration

**Files:**
- Modify: `client/src/services/ChatService.ts`
- Create: `client/src/hooks/useChat.ts`

**Step 1:** Expand ChatService with: sendPublicMessage(), sendDM(), sendRoomMessage(), loadHistory().

**Step 2:** Create useChat hook for React components.

**Step 3:** Wire all chat UI components through ChatService (not direct network calls).

**Step 4:** Commit.

```bash
git commit -m "feat: complete ChatService with all chat types and useChat hook"
```

---

### Task 3.10: Phase 3 Verification

**Step 1:** Test public chat — messages appear for all players, persist after refresh.

**Step 2:** Test room chat — enter meeting room, chat is scoped, leave and it disappears.

**Step 3:** Test DM — walk near player, press R, floating bubble opens. Also test from roster panel.

**Step 4:** Commit any fixes.

```bash
git commit -m "fix: Phase 3 verification fixes"
```

---

## Phase 4: Meeting Room Collaboration

**Goal:** Voice chat, screen sharing, and whiteboard in meeting rooms via self-hosted PeerJS + Coturn.

**Reference:** `docs/plans/2026-04-10-04-chat-communication.md`

### Task 4.1: Add PeerJS + Coturn to Docker Compose

**Files:**
- Modify: `docker-compose.yml`

**Step 1:** Add peerjs and coturn services:

```yaml
peerjs:
  image: peerjs/peerjs-server
  command: peerjs --port 9000 --path /peerjs
  restart: unless-stopped
  expose:
    - "9000"

coturn:
  image: coturn/coturn
  restart: unless-stopped
  ports:
    - "3478:3478/udp"
    - "3478:3478/tcp"
    - "49152-49200:49152-49200/udp"
  environment:
    - TURN_USERNAME=nexvoffice
    - TURN_PASSWORD=${TURN_PASSWORD:-nexvoffice_dev}
    - TURN_REALM=nexvoffice
```

**Step 2:** Add Express proxy for `/peerjs` path to the PeerJS container.

**Step 3:** Commit.

```bash
git commit -m "feat: add PeerJS and Coturn to Docker Compose"
```

---

### Task 4.2: Restore WebRTC with Self-Hosted PeerJS

**Files:**
- Modify: `client/src/web/WebRTC.ts`

**Step 1:** Restore WebRTC class but configured for self-hosted PeerJS:

```typescript
this.myPeer = new Peer(sanitizedId, {
  host: window.location.hostname,
  port: window.location.port ? parseInt(window.location.port) : 443,
  path: '/peerjs',
  secure: window.location.protocol === 'https:',
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      {
        urls: `turn:${window.location.hostname}:3478`,
        username: 'nexvoffice',
        credential: turnPassword  // from server config endpoint
      }
    ]
  }
})
```

**Step 2:** Commit.

```bash
git commit -m "feat: restore WebRTC with self-hosted PeerJS and TURN"
```

---

### Task 4.3: Create VoiceService

**Files:**
- Create: `client/src/services/VoiceService.ts`

**Step 1:** Implement VoiceService: joinRoom(), leaveRoom(), toggleMic(), toggleCamera(), onNewMember(), onMemberLeft().

**Step 2:** Voice connections scoped to room members only (uses zone membership).

**Step 3:** Commit.

```bash
git commit -m "feat: create VoiceService for room-scoped voice chat"
```

---

### Task 4.4: Create ScreenShareService

**Files:**
- Modify: `client/src/web/ShareScreenManager.ts`
- Create: `client/src/services/ScreenShareService.ts`

**Step 1:** Restore ShareScreenManager with self-hosted PeerJS config.

**Step 2:** Create ScreenShareService that wraps it and scopes to meeting rooms.

**Step 3:** Commit.

```bash
git commit -m "feat: create ScreenShareService for room-scoped screen sharing"
```

---

### Task 4.5: Meeting Panel UI

**Files:**
- Create: `client/src/components/game/MeetingPanel.tsx`

**Step 1:** Create MeetingPanel that appears when player enters a meeting room. Shows: Mic toggle, Camera toggle, Share Screen button, Whiteboard button, member list.

**Step 2:** Wire to VoiceService and ScreenShareService.

**Step 3:** Commit.

```bash
git commit -m "feat: MeetingPanel UI with voice, screen share, and whiteboard controls"
```

---

### Task 4.6: Auto-Join Voice on Room Enter

**Files:**
- Modify: `client/src/services/RoomService.ts` (create if not exists)
- Create: `client/src/hooks/useCurrentRoom.ts`

**Step 1:** Create RoomService that listens for ENTER_ZONE/LEAVE_ZONE and orchestrates: join room chat, optionally auto-connect voice (mic muted by default), show MeetingPanel.

**Step 2:** Create useCurrentRoom hook.

**Step 3:** Commit.

```bash
git commit -m "feat: auto-join voice on meeting room entry"
```

---

### Task 4.7: Whiteboard Integration

**Files:**
- Modify: `client/src/components/game/WhiteboardDialog.tsx`

**Step 1:** Replace external wbo.ophir.dev iframe with self-contained whiteboard. Options:
- Use `@excalidraw/excalidraw` React component (simplest, no extra server)
- Whiteboard state shared via Colyseus room state (room-scoped)

**Step 2:** Commit.

```bash
git commit -m "feat: self-hosted whiteboard using excalidraw"
```

---

### Task 4.8: Screen Share Video Panel

**Files:**
- Modify: `client/src/components/game/ComputerDialog.tsx`

**Step 1:** Refactor ComputerDialog to show shared screens from room members. When someone shares, all room members see the video stream.

**Step 2:** Only one share at a time per room — UI shows who's sharing.

**Step 3:** Commit.

```bash
git commit -m "feat: shared screen video panel for meeting rooms"
```

---

### Task 4.9: Phase 4 Verification

**Step 1:** Docker compose up — verify PeerJS and Coturn start.

**Step 2:** Two browser tabs → same meeting room → voice connects, can hear each other.

**Step 3:** Test screen share — one tab shares, other sees it.

**Step 4:** Test whiteboard — both tabs can draw.

**Step 5:** Walk out of room — verify disconnect.

**Step 6:** Commit any fixes.

```bash
git commit -m "fix: Phase 4 verification fixes"
```

---

## Phase 5: AI NPC Engine

**Goal:** AI-powered NPCs that join the office as characters, respond to conversations and @mentions.

**Depends on:** Phase 1 (Phase 2 for room-specific NPC placement, but NPC engine works in lobby mode without it).

**Reference:** `docs/plans/2026-04-10-05-ai-npc-engine.md`

### Task 5.1: NPC Agent Schema & API

**Files:**
- Create: `server/api/npc.ts`

**Step 1:** Create REST endpoints:
- `GET /api/npcs` — list all NPCs
- `POST /api/npcs` — create NPC (admin only)
- `PUT /api/npcs/:id` — update NPC
- `DELETE /api/npcs/:id` — deactivate NPC
- `POST /api/npcs/:id/knowledge` — upload knowledge document
- `GET /api/npcs/:id/tools` — list available MCP tools for this NPC

**Step 2:** Commit.

```bash
git commit -m "feat: NPC agent CRUD API"
```

---

### Task 5.2: AI Gateway — Bedrock Integration

**Files:**
- Create: `server/npc/ai-gateway.ts`
- Modify: `package.json` (add `@aws-sdk/client-bedrock-runtime`)

**Step 1:** Create AIGateway class:
- `chat(systemPrompt, messages, tools?, ragContext?)` → calls Bedrock Nova Pro
- `embed(text)` → calls Bedrock Titan Embeddings
- Handle streaming responses for typing animation

**Step 2:** Commit.

```bash
git commit -m "feat: AI Gateway with Bedrock Nova Pro integration"
```

---

### Task 5.3: RAG — Knowledge Indexing Pipeline

**Files:**
- Create: `server/npc/rag.ts`
- Create: `server/api/upload.ts`

**Step 1:** Implement document upload → chunking (500 tokens, 50 overlap) → Titan embeddings → pgvector storage.

**Step 2:** Implement query: embed question → pgvector nearest 5 → return chunks.

**Step 3:** Commit.

```bash
git commit -m "feat: RAG pipeline with document chunking and pgvector search"
```

---

### Task 5.4: MCP Client

**Files:**
- Create: `server/npc/mcp-client.ts`

**Step 1:** Implement MCP protocol client:
- Connect to MCP server URL
- Discover available tools
- Call tools with parameters
- Return results

**Step 2:** Tool whitelist check against npc_tool_permissions.

**Step 3:** User token injection for user-scoped calls.

**Step 4:** Commit.

```bash
git commit -m "feat: MCP client with tool discovery and whitelist"
```

---

### Task 5.5: Prompt Builder

**Files:**
- Create: `server/npc/prompt-builder.ts`

**Step 1:** Assemble prompts from: NPC persona + RAG context + conversation history + tool definitions + user context (name, role, linked accounts).

**Step 2:** Different assembly for agents (include tools) vs ghosts (no tools, add ghost intro).

**Step 3:** Commit.

```bash
git commit -m "feat: prompt builder for NPC conversations"
```

---

### Task 5.6: Conversation Manager

**Files:**
- Create: `server/npc/conversation.ts`

**Step 1:** Manage per user-NPC conversation sessions:
- Create session on START_NPC_CONVERSATION
- Track message history (context window)
- 5-minute idle timeout
- Save conversation to chat_messages on end

**Step 2:** Commit.

```bash
git commit -m "feat: NPC conversation session manager"
```

---

### Task 5.7: NPC Engine — Bot Manager

**Files:**
- Create: `server/npc/engine.ts`

**Step 1:** On server boot:
- Load active NPCs from DB
- For each NPC, create a Colyseus client that joins the room
- NPC appears as a character in the game world

**Step 2:** Handle NPC lifecycle: create, destroy, reload on config change.

**Step 3:** Commit.

```bash
git commit -m "feat: NPC engine joins NPCs as Colyseus clients"
```

---

### Task 5.8: NPC Behavior Controller

**Files:**
- Create: `server/npc/behavior.ts`

**Step 1:** Implement NPC movement behaviors:
- `stay_at_desk`: fixed position, idle animation
- `wander_room`: random movement within room zone bounds
- `wander_freely`: random movement across office
- `go_to_meeting`: pathfind to meeting room when @mentioned
- `face_user`: turn toward user when in conversation

**Step 2:** Send position updates to Colyseus (same as player updates).

**Step 3:** Commit.

```bash
git commit -m "feat: NPC behavior controller with movement patterns"
```

---

### Task 5.9: NPC Character — Client Side

**Files:**
- Create: `client/src/characters/NPCCharacter.ts`
- Modify: `client/src/scenes/Game.ts`
- Modify: `client/src/characters/PlayerSelector.ts`

**Step 1:** Create NPCCharacter extending Player:
- Glow outline (blue for agent, gray for ghost)
- Ghost transparency (alpha 0.5)
- Interaction prompt: "Press R to talk to [name]"
- Typing animation when AI is processing

**Step 2:** Game.ts creates NPCCharacter for NPC-type players.

**Step 3:** PlayerSelector detects NPCs for interaction.

**Step 4:** Commit.

```bash
git commit -m "feat: NPCCharacter client-side with visual modifiers"
```

---

### Task 5.10: NPC Dialog UI

**Files:**
- Create: `client/src/components/chat/NPCDialog.tsx`
- Create: `client/src/services/NPCService.ts`
- Create: `client/src/hooks/useNPC.ts`

**Step 1:** Create NPCDialog — dedicated 1-on-1 conversation window. Shows NPC avatar, name, typing indicator, message history.

**Step 2:** Create NPCService: startConversation(), sendMessage(), endConversation().

**Step 3:** Create useNPC hook.

**Step 4:** Commit.

```bash
git commit -m "feat: NPC dialog UI and NPCService"
```

---

### Task 5.11: @mention in Meeting Rooms

**Files:**
- Modify: `client/src/components/chat/ChatPanel.tsx`
- Modify: `server/rooms/SkyOffice.ts`

**Step 1:** In ChatPanel, detect @npcname pattern. Send MENTION_NPC message.

**Step 2:** Server routes to NPC engine with meeting context (room chat history, participants).

**Step 3:** NPC response posted to room channel.

**Step 4:** NPC walks to meeting room if not already there.

**Step 5:** Commit.

```bash
git commit -m "feat: @mention NPC in meeting room chat"
```

---

### Task 5.12: Phase 5 Verification

**Step 1:** Create an NPC via API. Verify it appears in the office.

**Step 2:** Walk up to NPC, press R → dialog opens. Ask a question → get response.

**Step 3:** Upload a document to NPC → ask about its contents → verify RAG retrieval.

**Step 4:** @mention NPC in meeting room → verify response in room chat.

**Step 5:** Test ghost type: verify no tool calls, translucent appearance.

**Step 6:** Commit any fixes.

```bash
git commit -m "fix: Phase 5 verification fixes"
```

---

## Phase 6: Gamification & Tasks (parallel with Phase 5)

**Goal:** HP/beating system, task management, daily schedules, McDonald's link.

**Reference:** `docs/plans/2026-04-10-07-gamification-tasks.md`

### Task 6.1: Player HP State

**Files:**
- Modify: `server/rooms/schema/OfficeState.ts`
- Modify: `types/IOfficeState.ts`

**Step 1:** Add `hp`, `maxHp` fields to Player schema (default 100).

**Step 2:** Add daily reset cron: on server, check `last_reset_at` and reset all HP at midnight.

**Step 3:** Commit.

```bash
git commit -m "feat: add HP to player state with daily reset"
```

---

### Task 6.2: Beating Mechanic — Server

**Files:**
- Create: `server/rooms/commands/BeatPlayerCommand.ts`
- Modify: `server/rooms/SkyOffice.ts`

**Step 1:** Handle BEAT_PLAYER message:
- Check cooldown (3 seconds)
- Deduct 10 HP from target (minimum 0)
- Broadcast HP_UPDATE to all players
- Send chat notification: "Frank beat Alice! (-10 HP)"

**Step 2:** Commit.

```bash
git commit -m "feat: beating mechanic server-side with cooldown"
```

---

### Task 6.3: Beating Mechanic — Client

**Files:**
- Modify: `client/src/characters/MyPlayer.ts`
- Create: `client/src/components/game/PlayerHUD.tsx`

**Step 1:** Add B key binding. When pressed near another player, send BEAT_PLAYER.

**Step 2:** Create PlayerHUD showing HP bar above character (green→yellow→red).

**Step 3:** On beat received: target sprite flashes red, small knockback animation.

**Step 4:** Commit.

```bash
git commit -m "feat: beating mechanic client-side with HP bar and visual feedback"
```

---

### Task 6.4: Vending Machine → McDonald's

**Files:**
- Modify: `client/src/characters/MyPlayer.ts`
- Modify: `client/src/items/VendingMachine.ts`

**Step 1:** Change vending machine dialog text to "Press R to order McDonald's".

**Step 2:** Change URL from buymeacoffee to McDonald's website.

**Step 3:** Commit.

```bash
git commit -m "feat: vending machine links to McDonald's"
```

---

### Task 6.5: Task API

**Files:**
- Create: `server/api/tasks.ts`

**Step 1:** Create REST endpoints:
- `GET /api/tasks` — list tasks (filter: assigned_to, created_by, status)
- `POST /api/tasks` — create task
- `PUT /api/tasks/:id` — update task
- `DELETE /api/tasks/:id` — delete task
- `GET /api/schedules` — get user's schedule
- `POST /api/schedules` — create schedule item
- `PUT /api/schedules/:id` — update schedule item
- `DELETE /api/schedules/:id` — delete schedule item

**Step 2:** Real-time notifications via Colyseus: TASK_ASSIGNED, TASK_UPDATED.

**Step 3:** Commit.

```bash
git commit -m "feat: task and schedule CRUD REST API"
```

---

### Task 6.6: Task Panel UI

**Files:**
- Create: `client/src/components/tasks/TaskPanel.tsx`
- Create: `client/src/components/tasks/TaskCard.tsx`
- Create: `client/src/stores/taskStore.ts`
- Create: `client/src/hooks/useTasks.ts`

**Step 1:** Create TaskPanel sidebar: "My Tasks" and "Team Tasks" tabs. Create button, status toggles, due dates.

**Step 2:** Create taskStore and useTasks hook.

**Step 3:** Commit.

```bash
git commit -m "feat: task panel UI with my tasks and team view"
```

---

### Task 6.7: Schedule View UI

**Files:**
- Create: `client/src/components/tasks/ScheduleView.tsx`

**Step 1:** Create ScheduleView — daily timeline showing time blocks. CRUD operations for schedule items.

**Step 2:** Show current schedule item as status under player name (optional).

**Step 3:** Commit.

```bash
git commit -m "feat: daily schedule view with time blocks"
```

---

### Task 6.8: Phase 6 Verification

**Step 1:** Test HP: verify bar shows, beating works, cooldown enforced, daily reset.

**Step 2:** Test tasks: create, assign, update status, verify team can see.

**Step 3:** Test schedule: create time blocks, verify visible to others.

**Step 4:** Test vending machine: opens McDonald's.

**Step 5:** Commit any fixes.

```bash
git commit -m "fix: Phase 6 verification fixes"
```

---

## Phase 7: Admin Panel & Polish

**Goal:** Admin UI for office management, NPC configuration, user management. Final polish.

### Task 7.1: Admin Panel Shell

**Files:**
- Create: `client/src/components/admin/AdminPanel.tsx`
- Modify: `client/src/App.tsx`

**Step 1:** Create AdminPanel with tabs: Users, Office Layout, NPCs, Settings. Only visible to admin role.

**Step 2:** Add admin button to HelperButtonGroup (visible only to admins).

**Step 3:** Commit.

```bash
git commit -m "feat: admin panel shell with tab navigation"
```

---

### Task 7.2: User Manager UI

**Files:**
- Create: `client/src/components/admin/UserManager.tsx`

**Step 1:** Table of users with: create, edit, deactivate. Invite flow (admin sets username + temp password).

**Step 2:** Commit.

```bash
git commit -m "feat: user manager admin UI"
```

---

### Task 7.3: Office Editor UI

**Files:**
- Create: `client/src/components/admin/OfficeEditor.tsx`
- Create: `client/src/components/admin/TemplateLibrary.tsx`

**Step 1:** Grid-based editor: drag room templates onto grid cells. Preview stitched result.

**Step 2:** Template library panel showing available templates with preview thumbnails.

**Step 3:** Save → calls API → regenerates map → Colyseus room reloads.

**Step 4:** Commit.

```bash
git commit -m "feat: office grid editor with template library"
```

---

### Task 7.4: NPC Manager UI

**Files:**
- Create: `client/src/components/admin/NPCManager.tsx`

**Step 1:** Implement the 7-step NPC creation wizard:
1. Name + type (agent/ghost)
2. Avatar selection + visual modifiers
3. Personality/system prompt with templates
4. Knowledge sources (upload docs)
5. MCP tools whitelist (agent only)
6. Placement (room + position + behavior)
7. Ghost identity (ghost only)

**Step 2:** List view of existing NPCs with edit/delete.

**Step 3:** Commit.

```bash
git commit -m "feat: NPC manager admin UI with 7-step creation wizard"
```

---

### Task 7.5: Remove SkyOffice Branding

**Files:**
- Modify: `client/src/components/HelperButtonGroup.tsx`
- Modify: various files with "SkyOffice" references

**Step 1:** Remove GitHub/Twitter links, buy-me-a-coffee references. Replace "SkyOffice" with "NexVOffice" throughout.

**Step 2:** Update page title, favicon, logo.

**Step 3:** Commit.

```bash
git commit -m "chore: rebrand SkyOffice to NexVOffice"
```

---

### Task 7.6: Redis Session Store

**Files:**
- Modify: `docker-compose.yml`
- Modify: `server/auth/service.ts`

**Step 1:** Add Redis service. Use Redis for JWT token blacklist (logout) and session caching.

**Step 2:** Commit.

```bash
git commit -m "feat: add Redis for session management"
```

---

### Task 7.7: Environment Configuration

**Files:**
- Create: `.env.example`
- Modify: `server/config.ts`

**Step 1:** Document all environment variables:

```env
# Database
DB_PASSWORD=nexvoffice_dev

# Auth
JWT_SECRET=change-me-in-production
ADMIN_DEFAULT_PASSWORD=changeme

# WebRTC
TURN_PASSWORD=nexvoffice_dev

# AI / Bedrock
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
BEDROCK_MODEL_ID=amazon.nova-pro-v1:0
BEDROCK_EMBED_MODEL_ID=amazon.titan-embed-text-v2:0

# MCP
MCP_NEXFINA_URL=http://localhost:3001
```

**Step 2:** Commit.

```bash
git commit -m "chore: add .env.example with all configuration variables"
```

---

### Task 7.8: Phase 7 & Final Verification

**Step 1:** Full Docker compose up from scratch — verify all 5 services start.

**Step 2:** Admin flow: login → create users → design office → create NPC → verify it works.

**Step 3:** User flow: login → walk around → chat → enter meeting → voice → share screen → talk to NPC → check tasks.

**Step 4:** Commit any final fixes.

```bash
git commit -m "fix: final verification fixes"
```

---

## Summary

| Phase | Tasks | Can Parallel With |
|-------|-------|-------------------|
| Phase 0: Foundation | 12 | — |
| Phase 1: Database & Auth | 10 | — |
| Phase 2: Map & Rooms | 11 | — |
| Phase 3: Chat | 10 | — |
| Phase 4: Meeting Collab | 9 | — |
| Phase 5: AI NPC | 12 | Phase 6 |
| Phase 6: Gamification | 8 | Phase 5 |
| Phase 7: Admin & Polish | 8 | — |
| **Total** | **80 tasks** | |

Recommended execution: Phase 0 → 1 → 2 → 3 → 4 → (5 ∥ 6) → 7
