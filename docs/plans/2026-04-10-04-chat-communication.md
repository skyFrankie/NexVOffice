# Chat & Communication System

**Date:** 2026-04-10
**Series:** NexVOffice Design Docs — Part 4 of 7

---

## Chat Hierarchy

| Chat type | Trigger | Persisted | Scope |
|---|---|---|---|
| Public | Always visible in chat panel | Yes | Everyone in office |
| Room | Auto-join when entering meeting room zone | Yes | Room members only |
| DM (proximity) | Walk near player + press R | Yes | 2 players, floating bubble |
| DM (roster) | Click player in roster panel | Yes | 2 players, side panel |
| NPC dialog | Walk near NPC + press R | Yes | 1 player + 1 NPC, dedicated window |
| NPC @mention | Type @name in room chat | Yes | Room members see response |

Proximity DM and roster DM share the same `chat_channel` — start by walking up, continue later from roster. Same message history.

---

## Chat Panel UI (ChatPanel.tsx)

- Tabs: **Public** | **Room** (when in a room) | **DMs**
- DM tab shows `DMList.tsx` — roster of all online players, click to open DM
- Each tab loads messages from its `chat_channel` via REST API (history) + Colyseus (real-time)

---

## Proximity Quick Chat

- `OtherPlayer` overlap detected → "Press R to chat with Alice"
- Press R → opens floating DM bubble anchored near characters
- Client sends `START_PROXIMITY_CHAT { targetUserId }`
- Server finds or creates DM `chat_channel` between both users
- Walk away → bubble stays open for 30s then auto-minimizes
- Messages go through normal DM pipeline (`ChatService.sendDM`)

---

## Meeting Room Chat

- Player enters room zone → auto-joins room's `chat_channel`
- ChatPanel shows Room tab with room-scoped messages
- `@mention` NPCs: type `@accountant question` → server routes `MENTION_NPC`
- NPC response posted to room channel, all members see it
- Leave room → leave channel, Room tab disappears

---

## PeerJS Voice Chat (meeting rooms only)

- Self-hosted PeerJS server (Docker container)
- `VoiceService.ts` manages connections
- Enter meeting room → `VoiceService.joinRoom(roomId)` creates PeerJS mesh with room members
- Mic defaults to muted, click to toggle
- Leave room → `VoiceService.leaveRoom()` disconnects all peer calls
- Coturn (Docker) as TURN relay for NAT traversal
- ICE servers config: STUN (Google public) + TURN (self-hosted coturn)

---

## Voice Service Architecture

```typescript
VoiceService:
  - peer: Peer (connected to self-hosted PeerJS)
  - roomPeers: Map<string, MediaConnection>
  - joinRoom(roomId, memberSessionIds): get mic stream, call each member
  - leaveRoom(): close all connections
  - onNewMember(memberId): call new joiner
  - onMemberLeft(memberId): close connection
  - toggleMic(): enable/disable audio track
```

---

## Screen Share in Meetings

- `ScreenShareService.ts` — restored from stub, scoped to rooms
- Click "Share" in MeetingPanel → browser `getDisplayMedia` prompt
- Stream sent to all room members via PeerJS
- One share at a time per room (server tracks active sharer)
- Other members see shared screen in a video panel
- Leave room or click Stop → share ends

---

## Meeting Panel UI (MeetingPanel.tsx)

Appears when player enters a meeting room:

```
+------------------------------------------+
| Mic  Camera  Share  Board                |
| [On]  [Off]  [Share]  [Open]             |
|                                          |
| In room: Frank, Alice, Accountant (NPC)  |
+------------------------------------------+
```

---

## Whiteboard

- Options: self-hosted excalidraw (npm package in React) OR iframe
- **Recommendation:** excalidraw React component for v1 — no extra Docker container
- Whiteboard state synced via Colyseus (room-scoped)
- Each meeting room has its own whiteboard that persists

---

## New Message Types

```
SEND_DM
SEND_ROOM_MESSAGE
MENTION_NPC
START_PROXIMITY_CHAT
PROXIMITY_CHAT_OPENED
ENTER_ZONE
LEAVE_ZONE
JOIN_VOICE
LEAVE_VOICE
```

---

## Docker Additions

```yaml
peerjs:
  image: peerjs/peerjs-server
  command: peerjs --port 9000 --path /peerjs
  expose:
    - "9000"

coturn:
  image: coturn/coturn
  ports:
    - "3478:3478/udp"
    - "3478:3478/tcp"
    - "49152-49200:49152-49200/udp"
  environment:
    - TURN_USERNAME=nexvoffice
    - TURN_PASSWORD=${TURN_PASSWORD}
    - TURN_REALM=nexvoffice
```

Express proxies `/peerjs` to the PeerJS container so the client connects to a single host.
