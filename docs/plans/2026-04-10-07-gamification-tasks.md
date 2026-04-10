# Gamification & Task System

**Date:** 2026-04-10
**Series:** NexVOffice Design Documents — Doc 7 of 7
**Title:** Gamification & Task System

---

## HP System

### Overview

Every user starts with 100 HP. HP is persistent across sessions (stored in the database) and is visible to all players in the office as a bar above the character's head.

### Storage

HP lives in the `player_stats` table (see Doc 2 — Database & Auth):

```sql
player_stats (
  user_id       UUID REFERENCES users(id),
  hp            INTEGER DEFAULT 100,
  max_hp        INTEGER DEFAULT 100,
  last_beat_at  TIMESTAMP,
  PRIMARY KEY (user_id)
)
```

### Visual Display

The HP bar is rendered by `Player.ts` using Phaser graphics:
- Full bar width = 40px, height = 4px, positioned 6px above the character sprite
- Color thresholds:
  - 60–100%: green (`0x22c55e`)
  - 30–59%: yellow (`0xeab308`)
  - 0–29%: red (`0xef4444`)
- Bar updates immediately on `HP_UPDATE` Colyseus message
- HP value is part of the Colyseus `PlayerState` schema so all clients see live values

### Daily Reset

A server-side cron job resets all HP to `max_hp` at midnight:
- Configurable timezone per office (stored in `office_settings`)
- Default: UTC midnight
- Implementation: Node.js `node-cron` scheduler in the server process, or a separate worker
- Reset fires a `HP_UPDATE` broadcast to all connected clients so bars refresh live

---

## Beating Mechanic

### How It Works

1. Player A presses B while standing near Player B
2. Client checks cooldown (3 seconds since last beat) — blocks if too soon
3. Client sends `BEAT_PLAYER { targetUserId }` to Colyseus server
4. Server validates: is target in the same room? Is the beat cooldown elapsed server-side?
5. Server deducts 10 HP from target (configurable via `office_settings.beat_damage`, default 10)
6. Server broadcasts `HP_UPDATE { userId, hp, maxHp }` to all clients in the room
7. Server broadcasts a chat notification to the room channel

### Visual Feedback

- Target sprite flashes red: 3 rapid tint cycles (`0xff0000` → original) over 400ms
- Small knockback: target moves 8px in the direction away from attacker over 200ms, then returns
- Chat notification in room channel: `"Frank beat Alice! (-10 HP)"`

### Cooldown

- 3-second cooldown enforced on both client (UX) and server (validation)
- `lastBeatTime` stored in `PlayerState` as a Unix timestamp
- Server rejects beats that arrive before `lastBeatTime + 3000ms`

### v1 Scope

At 0 HP the player stays at 0 and can continue doing everything normally. HP is cosmetic in v1 — it shows who is getting beaten without mechanical consequences. This is intentional: the mechanic is fun without punishment.

### Extensibility

The HP system is designed for future consequences:
- `onHpZero()` hook in server room handler — currently a no-op
- Future: knocked-out state, teleport to hospital room, 5-minute cooldown timer
- Future: configurable `consequence_at_zero` in `office_settings`

---

## Player State Extension

```typescript
// server/src/rooms/schema/PlayerState.ts (Colyseus schema)
class PlayerState extends Schema {
  // Existing fields
  @type('string') name: string = ''
  @type('number') x: number = 0
  @type('number') y: number = 0
  @type('string') anim: string = ''
  @type('string') readyToConnect: string = ''

  // New fields
  @type('number') hp: number = 100
  @type('number') maxHp: number = 100
  @type('number') lastBeatTime: number = 0  // Unix ms timestamp, used for cooldown
}
```

The `hp` and `maxHp` fields sync automatically to all clients via Colyseus delta encoding. `lastBeatTime` is used for server-side cooldown validation only — it does not need to render in the UI.

---

## Vending Machine Redesign

### v1: McDonald's Integration

- Pressing R on the vending machine opens the McDonald's website in a new browser tab
- The interaction prompt changes from the generic "Press R" to "Press R to order McDonald's"
- `VendingMachine.ts`: replace the `buymeacoffee.com` URL with `https://www.mcdonalds.com/`
- The dialog shown before opening the tab: "Hungry? We're redirecting you to McDonald's..."

### v2 Extensibility (Not in Scope for v1)

The item interaction system supports opening an in-game overlay instead of an external URL. Future versions can:
- Show a drink/food selector UI within the game
- Allow selecting a coworker as the recipient
- Generate a Colyseus notification: `"Frank sent you a coffee!"`
- Track orders in the database for fun team stats

The `VendingMachine.ts` item should expose an `onInteract()` method that currently calls `window.open()` but can be swapped for an overlay trigger without changing the interaction detection logic.

---

## Task System

### Data Model

```typescript
interface Task {
  id: string               // UUID
  title: string
  description: string
  status: 'todo' | 'in_progress' | 'done'
  dueDate: string | null   // ISO 8601
  assignedTo: string       // user_id
  createdBy: string        // user_id
  createdAt: string        // ISO 8601
  updatedAt: string        // ISO 8601
}
```

### REST API

| Method | Path | Description |
|---|---|---|
| GET | `/api/tasks` | List tasks visible to the current user |
| POST | `/api/tasks` | Create a new task |
| PUT | `/api/tasks/:id` | Update task fields (status, due date, etc.) |
| DELETE | `/api/tasks/:id` | Delete a task (creator or admin only) |

Query parameters for GET:
- `?assigned_to=me` — filter to current user's tasks
- `?assigned_to=:userId` — filter to a specific user
- `?status=todo|in_progress|done` — filter by status

### Real-Time Notifications

When a task is assigned or updated, the server sends a Colyseus message to the relevant player(s):

- `TASK_ASSIGNED { taskId, assignedTo, title }` — sent to the newly assigned user
- `TASK_UPDATED { taskId, status }` — broadcast to assignee and creator

The client `taskStore.ts` listens for these messages and updates local state. `TaskPanel.tsx` subscribes to the store and re-renders automatically.

### Views

**My Tasks** — tasks where `assignedTo === currentUser.id`
- Sorted by due date ascending, then by status (todo → in_progress → done)

**Team Tasks** — all tasks in the office
- Filterable by assignee using a dropdown
- Sortable by due date or status

Any user can create a task and assign it to any other user in the office.

---

## Task Panel UI

```
┌─────────────────────────────┐
│ Tasks              [+ New]  │
│ ─────────────────────────── │
│ My Tasks (3)   Team (12)    │
│ ─────────────────────────── │
│ ☐ Review PR #42       Today │
│ ◐ Fix login bug      Apr 11 │
│ ✓ Update docs        Apr 09 │
│ ─────────────────────────── │
│ Assigned by: Alice          │
│ ☐ Deploy staging     Apr 12 │
└─────────────────────────────┘
```

**Status icons:**
- `☐` = todo
- `◐` = in_progress
- `✓` = done

Clicking a task card opens an inline detail view with title, description, due date, and a status dropdown. The `[+ New]` button opens a small creation form with title, optional description, assignee picker, and due date.

The panel is accessible via the `HelperButtonGroup` task button and is toggled as a sidebar overlay — it does not block the game view.

---

## Daily Schedule

### Data Model

```typescript
interface ScheduleItem {
  id: string
  userId: string
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6   // 0 = Sunday
  startTime: string   // "HH:MM" in 24-hour format
  endTime: string     // "HH:MM" in 24-hour format
  label: string       // e.g. "Standup", "Focus Time", "Lunch"
}
```

### REST API

| Method | Path | Description |
|---|---|---|
| GET | `/api/schedules` | Get all schedules (all users, for team visibility) |
| GET | `/api/schedules/:userId` | Get schedule for a specific user |
| POST | `/api/schedules` | Create a schedule item |
| PUT | `/api/schedules/:id` | Update a schedule item |
| DELETE | `/api/schedules/:id` | Delete a schedule item |

### Team Visibility

All users can view all other users' schedules. This is intentional — the purpose of the schedule is to help teammates know when someone is busy. There is no private schedule option in v1.

### Optional: In-Game Status Text

If the current time falls within a schedule item's time range, the label can be displayed as a status line beneath the player's name tag in the game world. This is opt-in per user (toggle in profile settings).

Example: player name tag shows:
```
Frank
◉ Focus Time
```

---

## Schedule View UI

```
┌──────────────────────────────────────┐
│ Frank's Schedule — Thursday          │
│ ────────────────────────────────── │
│ 9:00  ██ Standup ██ 9:30             │
│ 10:00                                │
│ 11:00                                │
│ 12:00 ██ Lunch ████ 13:00            │
│ 14:00 ██ Focus Time ████ 15:00       │
│ 15:00                                │
│ 16:00                                │
│ 17:00 ██ Wrap-up ██ 17:30            │
│                                      │
│                      [Edit Schedule] │
└──────────────────────────────────────┘
```

The timeline renders as a vertical list of hour rows. Schedule items are drawn as colored horizontal blocks spanning the appropriate time range. Clicking `[Edit Schedule]` switches to an edit mode where items can be added, resized, or removed.

The current time is marked with a horizontal line across the timeline when viewing today's schedule.

---

## New Colyseus Message Types

```typescript
// Client → Server
BEAT_PLAYER     { targetUserId: string }

// Server → Client (broadcast or targeted)
HP_UPDATE       { userId: string, hp: number, maxHp: number }
TASK_ASSIGNED   { taskId: string, assignedTo: string, title: string }
TASK_UPDATED    { taskId: string, status: 'todo' | 'in_progress' | 'done' }
```

All messages are added to the message type enum in `server/src/rooms/GameRoom.ts` and handled in the `onMessage` dispatcher. Client-side handlers are registered in `NetworkService.ts`.

---

## Gamification Extensibility (Future — Not v1)

These items are documented for planning purposes and are explicitly out of scope for the initial release.

| Feature | Description |
|---|---|
| Leaderboard | "Most beaten this week", "Tasks completed this month" |
| Achievements | Badges for milestones (first task, 10 tasks completed, survived a week) |
| HP consequences | At 0 HP: knocked-out state, teleport to hospital room for 5 minutes |
| XP system | Gain XP for completing tasks, attending meetings, sending messages |
| Pet/companion | A small sprite that follows your character, customizable |
| Beat streaks | Consecutive beats without being beaten — displayed as a fire icon |
| Task streaks | N days in a row completing all assigned tasks |

The HP system, beat mechanic, and task system in v1 are designed with these extensions in mind. The `onHpZero()` hook, configurable `beat_damage`, and `player_stats` table are all intentional extension points.
