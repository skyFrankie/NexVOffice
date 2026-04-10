# NexVOffice Architecture Overview

Date: 2026-04-10
Series: Design Documents 1 of 7

---

## Product Vision

NexVOffice is a self-hosted, single-tenant virtual office for startups and small companies. Each deployment represents one company and one office. The product targets teams of 5-20 users initially, with a scaling path to 20-100.

The core proposition: a lightweight, ownable virtual office that teams can run on their own infrastructure, with AI-powered NPC assistants, spatial collaboration (voice/video by room proximity), and task management built in.

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (CLIENT)                         │
│                                                                 │
│   ┌─────────────┐   ┌──────────────┐   ┌──────────────────┐   │
│   │  Phaser3    │   │  React UI    │   │  Redux Store     │   │
│   │ (game world)│   │  (dialogs,   │   │  (app state)     │   │
│   │             │   │   panels)    │   │                  │   │
│   └──────┬──────┘   └──────┬───────┘   └────────┬─────────┘   │
│          │                 │                     │             │
│          └─────────────────┴─────────────────────┘             │
│                            │                                   │
│               ┌────────────▼────────────┐                      │
│               │     Service Layer       │                      │
│               │ (decouples React/Phaser/ │                      │
│               │      Redux)             │                      │
│               └────────────┬────────────┘                      │
│                            │                                   │
│               ┌────────────▼────────────┐                      │
│               │     Network Layer       │                      │
│               │   (Colyseus.js client)  │                      │
│               └────────────┬────────────┘                      │
└────────────────────────────│────────────────────────────────────┘
                             │ WebSocket (port 80)
┌────────────────────────────│────────────────────────────────────┐
│                     SERVER (EC2 Docker)                         │
│                            │                                   │
│   ┌────────────────────────▼────────────────────────────────┐  │
│   │                    App Container                         │  │
│   │                                                          │  │
│   │   ┌──────────────┐    ┌──────────────────────────────┐  │  │
│   │   │   Express    │    │          Colyseus            │  │  │
│   │   │ (static +    │    │   (rooms, real-time state)   │  │  │
│   │   │  REST API)   │    │                              │  │  │
│   │   └──────────────┘    └──────────────────────────────┘  │  │
│   │                                                          │  │
│   │   Modules: Auth | Chat | Task | NPC Engine               │  │
│   └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│   ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐  │
│   │  PostgreSQL  │   │  AI Gateway  │   │  PeerJS Server   │  │
│   │  (data +     │   │  Bedrock     │   │  (WebRTC signal, │  │
│   │  pgvector)   │   │  Nova Pro    │   │   private)       │  │
│   │              │   │  RAG         │   ├──────────────────┤  │
│   │              │   │  (pgvector)  │   │  Coturn          │  │
│   │              │   │  MCP Gateway │   │  (TURN relay,    │  │
│   └──────────────┘   └──────────────┘   │   private)       │  │
│                                         └──────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Docker Compose Services

Five containers compose a complete NexVOffice deployment:

| Service  | Purpose                                              |
|----------|------------------------------------------------------|
| app      | NexVOffice server (Express + Colyseus + REST API)    |
| postgres | Primary data store + pgvector for RAG embeddings     |
| peerjs   | WebRTC signaling server (internal, not exposed)      |
| coturn   | TURN relay for WebRTC NAT traversal (internal)       |
| redis    | Session store + future pub/sub message bus           |

PeerJS and Coturn are kept private (not externally exposed) to prevent abuse. All client WebRTC signaling goes through the app container which proxies to PeerJS.

---

## Tech Stack

| Layer         | Technology                                    |
|---------------|-----------------------------------------------|
| Game engine   | Phaser3                                       |
| Multiplayer   | Colyseus (server + client)                    |
| Frontend UI   | React + Redux + MUI                           |
| Backend       | Express + TypeScript                          |
| Database      | PostgreSQL + pgvector extension               |
| AI            | AWS Bedrock (Nova Pro), pgvector RAG          |
| WebRTC        | PeerJS (self-hosted) + Coturn                 |
| Client build  | Vite                                          |
| Server build  | tsc (TypeScript compiler)                     |
| Deployment    | Docker Compose on EC2                         |

---

## Module Boundaries

### Auth Module
- JWT-based authentication (stateless tokens)
- Seed admin account on first boot (admin/changeme), force password change on first login
- Admin creates user accounts via admin panel (invite-based, no self-registration)
- Colyseus `onAuth` verifies JWT before allowing room join
- Future: OAuth/SSO provider support

### Chat Module
- **Public channel**: company-wide broadcast
- **Room-scoped channel**: auto-joined on room entry, auto-left on room exit
- **DM channels**: proximity-triggered (walk near someone) or roster-initiated
- **NPC conversations**: 1-on-1 or small group with NPC agents

### Task Module
- Personal tasks with optional team visibility
- Collaborative assignment (admin or self-assign)
- Daily schedule tracking per user
- Status: todo / in_progress / done

### NPC Engine
- **Agent type**: has tool access (MCP connections) + knowledge base (RAG)
- **Ghost type**: knowledge-only (RAG), no tool execution
- NPCs join as Colyseus clients — they appear as characters in the game world
- Each NPC has a configurable personality, spawn location, and tool permissions
- MCP connections configured per NPC; tool whitelist managed in admin UI

### Map Module
- Template blocks (pre-built in Tiled), not a full Tiled editor for end users
- Admin grid editor: drag templates onto cells, system stitches into one tilemap
- Zone boundaries auto-derived from placement positions and template dimensions
- Entering a zone joins its collaboration features (chat, voice, screenshare)

### Gamification
- HP (health points) per player, default 100
- Beating mechanic (players can damage each other within game rules)
- Daily reset to max HP at midnight (configurable timezone)

---

## Key Design Decisions

### 1. Single-tenant, self-hosted
No multi-tenancy overhead. One deployment = one company = one office. Simplifies data isolation, billing, and customization. Target operators are technical enough to run Docker Compose on a VPS or EC2.

### 2. Service Layer on client
A dedicated Service Layer decouples React UI components, Phaser game scenes, and the Redux store. Components call service methods; services dispatch Redux actions and call Colyseus/REST as needed. This prevents the common SkyOffice anti-pattern of Phaser scenes directly importing React components and vice versa.

### 3. REST API alongside Colyseus
- CRUD operations (create task, update NPC config, manage users) go through REST
- Real-time game state (positions, room joins, chat messages in flight) goes through Colyseus
- This avoids stuffing all game logic into Colyseus message handlers and keeps server logic testable

### 4. Rooms as spatial collaboration boundaries
Walking into a room on the map automatically:
- Joins that room's voice channel (if voice-enabled)
- Joins that room's scoped chat channel
- Enables screenshare and whiteboard if the room supports them
- On exit: all of the above are automatically torn down

### 5. NPC bots as Colyseus clients
NPC agents connect to the Colyseus room as first-class clients. They appear as characters on the map at their spawn positions. When a player walks close, proximity detection triggers a conversation. This gives NPCs a real presence in the office without special-casing them in the rendering layer.

### 6. Map from template blocks (not free-form Tiled editor)
Operators are not expected to be level designers. Pre-built templates (meeting rooms, open desks, hallways, lobby) snap onto a grid. The stitcher generates the final tilemap server-side. This constrains what operators can build but dramatically reduces setup complexity.

### 7. AWS Bedrock Nova Pro for AI
Nova Pro is cost-effective for the conversational NPC use case. Model selection is configurable per NPC (admin UI), allowing future substitution with other Bedrock models or a bring-your-own-endpoint option.

### 8. MCP integration via admin UI
MCP server URLs and tool permissions are configured entirely in the admin panel — no file editing required for operators. Tool whitelist is per NPC (not global), so a finance NPC can access accounting tools while a general assistant cannot.

### 9. NexFina auth separation
NexVOffice has its own auth system (JWT). NexFina (separate product) has its own. Users optionally link their NexFina account by storing a token in their NexVOffice profile. NPC MCP calls that require user context use this linked token. Users without a linked account can still interact with NPCs for RAG-based (knowledge) queries.
