# Map & Room System

Date: 2026-04-10
Series: Design Documents 3 of 7

---

## Template Block Concept

NexVOffice uses a Gather.town-style block system rather than exposing a full Tiled editor to operators. The key principles:

- **Pre-built templates**: Each room type is designed once in Tiled by a developer, exported as a JSON tilemap, and stored in the `room_templates` table.
- **Fixed block sizes**: Templates have fixed tile dimensions (e.g., 10x10 or 15x20 tiles). This makes snapping and stitching predictable.
- **Admin grid placement**: Operators place templates on a grid via a drag-and-drop admin UI. No tile-level editing required.
- **Server-side stitching**: The stitcher reads placements from the database and assembles a single Phaser-compatible tilemap at runtime. The client loads one map, not separate room maps.

This approach trades flexibility for simplicity. Operators configure their office layout in minutes without understanding Tiled.

---

## Room Templates

Each template row in `room_templates` defines a complete, self-contained room block:

| Field              | Description                                                         |
|--------------------|---------------------------------------------------------------------|
| `name`             | Human-readable name shown in admin UI ("Meeting Room S")            |
| `slug`             | Stable identifier used in code ("meeting-room-s")                   |
| `width_blocks`     | Width in grid cells (usually 1)                                     |
| `height_blocks`    | Height in grid cells (usually 1, hallways may be 1x2 or 2x1)       |
| `tile_data`        | Tiled JSON export — floor, wall, decoration layers                  |
| `item_slots`       | Array of `{ type, x, y, label }` — chairs, computers, whiteboards  |
| `npc_spawn_points` | Array of `{ x, y, label }` — optional positions for NPC placement   |
| `features`         | `{ voice, screenshare, whiteboard, privateChat }` — boolean flags   |
| `is_builtin`       | `true` for shipped templates; `false` for operator-created customs  |

### Grid Cell Size

Each grid cell is 10x10 tiles (320x320 pixels at 32px/tile). Templates larger than 10x10 span multiple cells via `width_blocks`/`height_blocks`.

### Zone Boundary
Each template implicitly defines a zone boundary equal to its full tile extent. The stitcher calculates the absolute pixel bounds after placement: `{ x: gridX * blockPixelWidth, y: gridY * blockPixelHeight, w: templateTileWidth * tileSize, h: templateTileHeight * tileSize }`.

---

## Built-in Templates

| Template      | Tile Size | Voice | Screen | Whiteboard | Chat         | Max Users  |
|---------------|-----------|-------|--------|------------|--------------|------------|
| Meeting Room S | 10x10    | Yes   | Yes    | Yes        | Private      | 4          |
| Meeting Room M | 10x15    | Yes   | Yes    | Yes        | Private      | 8          |
| Meeting Room L | 15x20    | Yes*  | Yes    | Yes        | Private      | 20         |
| Open Desk Area | 20x20    | No    | No     | No         | Public       | Unlimited  |
| Break Room     | 10x10    | Yes   | No     | No         | Private      | 10         |
| NPC Office     | 10x10    | No    | No     | No         | Private 1:1  | 2          |
| Lobby          | 15x10    | No    | No     | No         | Public       | Unlimited  |
| Hallway H      | 5x10     | No    | No     | No         | Public       | Unlimited  |
| Hallway V      | 10x5     | No    | No     | No         | Public       | Unlimited  |

**Notes:**
- "Private" chat means a scoped channel visible only to users currently in the room.
- "Public" chat means messages go to the company-wide public channel.
- "NPC Office" is the only template with a max of 2 — it is designed for 1-on-1 conversations with an NPC agent.
- Hallway H and Hallway V are the same content rotated; both are needed as separate templates because Tiled exports are not rotation-aware at the stitcher level.
- *Meeting Room L supports 20 users for text chat, but voice chat uses a WebRTC mesh which caps at 6 concurrent participants in v1. Users 7–20 can participate via text only. SFU (Selective Forwarding Unit) support for larger voice rooms is planned for v2.

---

## Admin Grid Editor (`OfficeEditor.tsx`)

The editor is a React component in the admin panel that provides a visual grid interface for office layout:

```
┌──────────────────────────────────────────────────────────────┐
│  Template Palette          │  Office Grid (5x4 default)      │
│                            │                                  │
│  [ Lobby          ]        │  ┌───┬───┬───┬───┬───┐          │
│  [ Meeting Room S ]        │  │Lby│MtS│   │   │   │          │
│  [ Meeting Room M ]        │  ├───┼───┼───┼───┼───┤          │
│  [ Open Desk Area ]        │  │Hwy│Dsk│Dsk│MtM│   │          │
│  [ Break Room     ]        │  ├───┼───┼───┼───┼───┤          │
│  [ NPC Office     ]        │  │   │   │Brk│NPC│   │          │
│  [ Hallway H      ]        │  ├───┼───┼───┼───┼───┤          │
│  [ Hallway V      ]        │  │   │   │   │   │   │          │
│                            │  └───┴───┴───┴───┴───┘          │
│                            │                                  │
│  [ Preview ]  [ Save ]     │  Drag template → drop on cell   │
└──────────────────────────────────────────────────────────────┘
```

**Interactions:**
- Drag a template from the palette onto a grid cell to place it.
- Click a placed template to rename the room or remove it.
- "Preview" renders the stitched tilemap in a read-only Phaser instance.
- "Save" writes all `room_placements` to the database and triggers map regeneration.

**On save:**
1. Client sends `PUT /api/admin/layout` with the full placement grid.
2. Server validates no overlaps, all template IDs exist.
3. Server calls `stitcher.regenerate(layoutId)` to produce the new tilemap JSON.
4. Server signals Colyseus to reload the map on the next room cycle (or immediately if no users are connected).

---

## Map Stitcher (`server/map/stitcher.ts`)

The stitcher assembles the final playable tilemap from placement data:

```
Input:  room_placements (DB rows) + room_templates (tile_data JSONB)
Output: Single Phaser-compatible Tiled JSON tilemap
```

**Algorithm:**

1. **Load layout**: Query `room_placements JOIN room_templates` for the active layout.
2. **Calculate canvas size**: `canvasWidth = gridWidth * blockTileWidth`, `canvasHeight = gridHeight * blockTileHeight`.
3. **Initialize output layers**: Create empty `floor`, `walls`, `decorations`, `collision` layers at canvas size.
4. **Stamp each template**: For each placement, copy the template's tile layers into the output canvas at the calculated offset (`gridX * blockTileWidth`, `gridY * blockTileHeight`).
5. **Generate wall borders**: After stamping, scan adjacent placement boundaries. If two rooms share an edge, generate a doorway tile at the midpoint. If a room borders empty space, place solid wall tiles.
6. **Calculate zone boundaries**: For each placement, emit a `RoomZone` record: `{ roomId, roomName, bounds: { x, y, w, h }, features }`. These are stored separately (in Redis or as a server-side in-memory map) for fast zone lookup.
7. **Output**: Serialize the assembled Tiled JSON. Write to a cache file and/or store in Redis for the Colyseus room to load.

**Tileset requirements**: All built-in templates must use the same base tilesets (same tileset IDs and GIDs). Custom templates must declare which tilesets they use; the stitcher merges tileset definitions in the output.

**v1 stitcher constraint:** v1 stitcher assumes all built-in templates share identical tileset definitions (same tilesets with same GIDs). No GID remapping is needed. Custom template support with GID remapping is deferred to v2.

**Wall authoring convention:** Templates must NOT include perimeter wall tiles. Only interior decoration and divider walls. The stitcher generates all perimeter walls and doorway openings.

---

## Zone Detection

Zone detection runs in two places for different reasons:

### Server-side (authoritative)
- On every `PLAYER_MOVE` message, the server checks the player's new position against all `RoomZone` bounds.
- If the player has entered a new zone: emit `ENTER_ZONE` to the client, add player to the room's chat channel, enable room features.
- If the player has left a zone: emit `LEAVE_ZONE`, remove from chat channel, disable features.
- Server is the source of truth — prevents clients from faking zone membership.

### Client-side (optimistic UI)
- The client also checks position against zone bounds locally on every move tick.
- Immediately updates UI indicators (room name label, feature icons) without waiting for server round-trip.
- If server disagrees (e.g., due to lag or anti-cheat), the server's `ENTER_ZONE`/`LEAVE_ZONE` message corrects the client state.

### Zone data structure

```typescript
interface RoomZone {
  roomId: string;          // room_placements.id
  roomName: string;        // display name
  bounds: {
    x: number;             // pixel x of top-left corner
    y: number;             // pixel y of top-left corner
    w: number;             // pixel width
    h: number;             // pixel height
  };
  features: {
    voice: boolean;
    screenshare: boolean;
    whiteboard: boolean;
    privateChat: boolean;
  };
}
```

### Zone Priority

If a player's position falls within multiple zones (e.g., at a doorway), the most recently entered zone takes priority.

### Zone Debounce

LEAVE_ZONE events are debounced by 500ms. If the player enters a new zone within the debounce window, the leave event for the previous zone is suppressed.

### Zone events

| Event        | Direction       | Payload                        | Effect                                      |
|--------------|-----------------|--------------------------------|---------------------------------------------|
| ENTER_ZONE   | Server → Client | `{ zone: RoomZone }`           | Join room chat, enable features, show label |
| LEAVE_ZONE   | Server → Client | `{ roomId: string }`           | Leave room chat, disable features           |
| ZONE_UPDATE  | Server → Client | `{ zones: RoomZone[] }`        | Full zone list refresh (on map reload)      |

---

## Current Limitations to Refactor

These are known issues in the SkyOffice base that must be addressed as part of the NexVOffice restructure:

| Code  | Current Behavior                           | Required Fix                                          |
|-------|--------------------------------------------|-------------------------------------------------------|
| C3    | 5 computers and 3 whiteboards hard-coded   | Derive counts and positions from `item_slots` in template `tile_data` |
| C4    | Player spawn position hard-coded (705,500) | Read spawn position from `room_templates.npc_spawn_points` or a dedicated `spawn` item slot on the Lobby template |
| C5    | Single monolithic room class               | Split into `OfficeRoom` (open world, public chat) and `MeetingRoom` (private, feature-enabled) extending a shared base |
| C7    | 485 lines of copy-pasted animation code    | Generate animation configs from a sprite metadata JSON file; one `registerAnimations(spriteKey, metadata)` call per character |

These refactors are prerequisites before the map system can be fully dynamic. C4 and C3 must be resolved before the stitcher output can drive game behavior. C5 must be resolved before zone-scoped features (voice, screenshare) can be cleanly enabled per room type. C7 is independent and can be done in parallel.
