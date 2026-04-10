# Client Architecture Refactoring

**Date:** 2026-04-10
**Series:** NexVOffice Design Documents — Doc 6 of 7
**Title:** Client Architecture Refactoring

---

## Problem: Current Coupling

The current codebase has severe coupling issues that create circular dependencies, make code untestable, and cause fragile behavior across the entire client.

### Coupling Issues Identified

**C1 — Redux reducers directly access Phaser scenes:**
- `ChatStore.ts:47`
- `ComputerStore.ts:41`
- `WhiteboardStore.ts:29`
- `UserStore.ts:29`

**C2 — React components directly access Phaser game objects:**
- `Chat.tsx:173`
- `LoginDialog.tsx:152`
- `RoomSelectionDialog.tsx:113`

### Circular Dependency Chain

```
React → Redux → Phaser → React
```

This circular chain means:
- Unit testing any layer requires mocking all three systems
- A bug in one layer can silently corrupt state in another
- Changes to Phaser scene structure break Redux reducers and React components simultaneously
- Hot module reloading and SSR are impossible

---

## Solution: Service Layer

Introduce a `services/` directory that mediates all cross-system communication. Services are the single point of contact between React/Redux and Phaser. Neither side imports the other directly.

**Before:**
```
React Component → phaserGame.scene.keys.game.network.addChatMessage()
```

**After:**
```
React Component → ChatService.sendMessage()
  └── dispatches Redux action
  └── sends Colyseus message
  └── emits Phaser event
```

Each service is a plain TypeScript class (or module) with no UI framework dependencies, making it independently testable.

---

## Redux Decoupling Fix

### Before (reducer touches Phaser directly):
```typescript
setFocused: (state, action) => {
  const game = phaserGame.scene.keys.game as Game
  action.payload ? game.disableKeys() : game.enableKeys()
}
```

### After (pure reducer + event-driven bridge):
```typescript
// Pure reducer — no Phaser import
setFocused: (state, action) => {
  state.focused = action.payload
}

// Bridge lives in a useEffect or service, not the reducer
store.subscribe(() => {
  const { focused } = store.getState().game
  phaserEvents.emit(focused ? Event.DISABLE_KEYS : Event.ENABLE_KEYS)
})
```

The bridge can be initialized once at app startup. The reducer stays serializable and testable. Phaser responds to events rather than being imperatively called from Redux.

---

## New Client Structure

```
client/src/
├── services/                    # NEW — decoupling layer between React/Redux and Phaser
│   ├── AuthService.ts           # Login, logout, token management
│   ├── ChatService.ts           # Send/receive messages across all channels
│   ├── NetworkService.ts        # Renamed from Network.ts — Colyseus room management
│   ├── RoomService.ts           # Zone transitions, room feature queries
│   ├── NPCService.ts            # NPC interaction lifecycle
│   ├── TaskService.ts           # Task CRUD + real-time sync
│   ├── PlayerService.ts         # Player state updates, HP, beat actions
│   ├── VoiceService.ts          # PeerJS voice call management
│   └── ScreenShareService.ts   # Screen share lifecycle
│
├── scenes/
│   ├── Bootstrap.ts             # Refactored — loads assets from map config, not hard-coded
│   ├── Background.ts            # Unchanged
│   └── Game.ts                  # Refactored — data-driven items & zones
│
├── characters/
│   ├── Player.ts                # Add HP bar, glow modifiers
│   ├── MyPlayer.ts              # Add beat action (key B)
│   ├── OtherPlayer.ts           # Remove hard-coded WebRTC call, add proximity chat trigger
│   ├── NPCCharacter.ts          # NEW — NPC with interaction prompt, behavior display
│   └── PlayerSelector.ts        # Add NPC detection
│
├── items/
│   ├── Item.ts
│   ├── Chair.ts
│   ├── Computer.ts
│   ├── Whiteboard.ts
│   └── VendingMachine.ts
│
├── components/
│   ├── auth/
│   │   └── LoginPage.tsx        # NEW — username/password auth form
│   │
│   ├── admin/
│   │   ├── AdminPanel.tsx       # NEW — tabbed admin interface
│   │   ├── OfficeEditor.tsx     # NEW — grid-based room placement tool
│   │   ├── NPCManager.tsx       # NEW — NPC creation wizard (7 steps)
│   │   ├── UserManager.tsx      # NEW — invite and manage office users
│   │   └── TemplateLibrary.tsx  # NEW — browse and apply room templates
│   │
│   ├── chat/
│   │   ├── ChatPanel.tsx        # Refactored — tabs: Public | Room | DMs
│   │   ├── ChatMessage.tsx
│   │   ├── DMList.tsx           # NEW — direct message roster panel
│   │   └── NPCDialog.tsx        # NEW — 1-on-1 NPC conversation window
│   │
│   ├── tasks/
│   │   ├── TaskPanel.tsx        # NEW — sidebar task list
│   │   ├── TaskCard.tsx
│   │   └── ScheduleView.tsx     # NEW — daily timeline view
│   │
│   ├── game/
│   │   ├── ComputerDialog.tsx   # Refactored — uses ScreenShareService
│   │   ├── WhiteboardDialog.tsx # Self-hosted whiteboard integration
│   │   ├── PlayerHUD.tsx        # NEW — HP bar, name tag, status indicator
│   │   ├── RoomIndicator.tsx    # NEW — "You are in: Marketing Room"
│   │   └── MeetingPanel.tsx     # NEW — voice/screen share/whiteboard controls
│   │
│   └── HelperButtonGroup.tsx    # Remove coffee link, add task/admin shortcut buttons
│
├── stores/
│   ├── index.ts
│   ├── authStore.ts             # NEW — user identity, token, isAdmin flag
│   ├── chatStore.ts             # Refactored — channels, DMs, room messages (NO Phaser access)
│   ├── taskStore.ts             # NEW — tasks and schedules
│   ├── npcStore.ts              # NEW — active NPC conversations, NPC catalog
│   ├── roomStore.ts             # Refactored — current zone, features, members
│   ├── gameStore.ts             # Renamed from userStore — HP, player state
│   ├── computerStore.ts         # Simplified — no direct Phaser calls
│   └── whiteboardStore.ts
│
├── web/
│   ├── WebRTC.ts                # Restored — self-hosted PeerJS
│   └── ShareScreenManager.ts   # Restored — scoped to room context
│
├── hooks/                       # NEW — React custom hooks
│   ├── useAuth.ts
│   ├── useChat.ts
│   ├── useCurrentRoom.ts
│   ├── useTasks.ts
│   └── useNPC.ts
│
└── events/
    └── EventCenter.ts           # Expanded — all Phaser/service events defined here
```

---

## App Entry Flow Change

### Before:
```
Browser
  → RoomSelectionDialog (pick a room)
  → LoginDialog (choose name + avatar)
  → Game
```

### After:
```
Browser
  → LoginPage (username + password)
  → Office loads (map from DB, avatar from user profile)
  → Game
```

The new flow treats the office as a single deployment-scoped environment. There is no room selection because each NexVOffice instance is one office. The user's avatar is stored in their profile rather than chosen fresh each session.

---

## Removed Components

| Component | Reason for Removal |
|---|---|
| `RoomSelectionDialog.tsx` | Replaced by auth flow — single office per deployment |
| `LoginDialog.tsx` | Replaced by `LoginPage.tsx` with proper credentials |
| `VideoConnectionDialog.tsx` | Already stubbed; replaced by `MeetingPanel` voice controls |

---

## New React Hooks

Each hook is a thin wrapper over the corresponding store and service, providing a stable API for components.

### `useAuth()`
```typescript
{
  user: User | null
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  isAdmin: boolean
}
```

### `useChat()`
```typescript
{
  messages: Message[]
  sendPublic: (text: string) => void
  sendDM: (toUserId: string, text: string) => void
  sendRoomMessage: (text: string) => void
}
```

### `useCurrentRoom()`
```typescript
{
  currentRoom: Room | null
  features: RoomFeatures          // hasComputer, hasWhiteboard, etc.
  members: Player[]
  isInMeeting: boolean
}
```

### `useTasks()`
```typescript
{
  myTasks: Task[]
  teamTasks: Task[]
  createTask: (data: NewTaskData) => Promise<Task>
  updateTask: (id: string, patch: Partial<Task>) => Promise<Task>
}
```

### `useNPC()`
```typescript
{
  startConversation: (npcId: string) => Promise<void>
  sendMessage: (text: string) => Promise<NPCResponse>
  endConversation: () => void
  mentionNPC: (npcId: string, context: string) => void
}
```

---

## Character System Changes

### `Player.ts`
- Add HP bar rendered as a Phaser graphics rectangle above the character's head
- Color transitions: green (100-60%), yellow (60-30%), red (30-0%)
- Add `setGlow(color: number)` method using Phaser FX pipeline
- Add `setNameTagColor(color: number)` for status-based coloring

### `MyPlayer.ts`
- Add B key binding for beat action — emits `BEAT_PLAYER` message with target user ID
- Add R key proximity chat on nearby players (currently R only works on interactive items)
- Beat action has a 3-second client-side cooldown enforced before sending

### `OtherPlayer.ts`
- Remove hard-coded WebRTC auto-call on proximity
- Add proximity detection event that fires `PLAYER_IN_RANGE` / `PLAYER_OUT_OF_RANGE`
- `MeetingPanel` listens to these events and offers a voice call button

### `NPCCharacter.ts` (NEW)
- Extends `Player`
- Renders an interaction prompt ("Press R to talk") when player is nearby
- Glow outline: blue = AI agent, gray = ghost/placeholder NPC
- Ghost NPCs render at 60% opacity
- Plays a typing animation (animated ellipsis above head) while waiting for AI response
- Does not participate in WebRTC — voice is out of scope for NPCs

### `PlayerSelector.ts`
- Extend overlap detection to include NPC sprites in addition to item sprites
- When an NPC is selected, emit `NPC_SELECTED` rather than `ITEM_SELECTED`

---

## Migration Path

1. Add `services/` directory and implement `NetworkService.ts` as a thin wrapper around the existing `Network.ts`
2. Refactor one store at a time — start with `chatStore.ts` (highest coupling)
3. Replace each direct Phaser call in reducers with an event emission via `EventCenter.ts`
4. Add `useAuth` and update entry point to render `LoginPage` before initializing Phaser
5. Delete `RoomSelectionDialog`, `LoginDialog`, `VideoConnectionDialog` after their replacements are verified
6. Add remaining services and hooks as their corresponding features are built
