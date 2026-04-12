# NexVOffice — Standard Operating Procedure

> Version: 1.0 | Updated: 2026-04-12

This document covers everything you need to set up, configure, and operate a NexVOffice instance from scratch. It is intended for developers and administrators.

---

## Table of Contents

1. [Prerequisites & First-Time Setup](#1-prerequisites--first-time-setup)
2. [Docker Compose Services](#2-docker-compose-services)
3. [Database Setup](#3-database-setup)
4. [Environment Variables Reference](#4-environment-variables-reference)
5. [Starting the Application](#5-starting-the-application)
6. [Admin Panel Guide](#6-admin-panel-guide)
   - [Accessing the Admin Panel](#61-accessing-the-admin-panel)
   - [User Management](#62-user-management)
   - [Office Layout Editor](#63-office-layout-editor)
   - [NPC Setup](#64-npc-setup)
   - [Office Settings](#65-office-settings)
7. [AWS Bedrock Setup](#7-aws-bedrock-setup)
8. [WebRTC & Voice Setup](#8-webrtc--voice-setup)
9. [Room Templates Reference](#9-room-templates-reference)
10. [Production Deployment](#10-production-deployment)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Prerequisites & First-Time Setup

### Required Software

| Tool | Minimum Version | Purpose |
|------|----------------|---------|
| Node.js | 20.x LTS | Server & client build |
| Yarn | 1.22+ | Package management |
| Docker | 24.x+ | Container runtime |
| Docker Compose | v2.x (bundled with Docker Desktop) | Service orchestration |
| AWS CLI | 2.x (optional) | Bedrock credential setup |

### Installation Steps

**1. Clone the repository**
```bash
git clone <repo-url>
cd NexVOffice
```

**2. Install dependencies**
```bash
# Install server dependencies
yarn install

# Install client dependencies
cd client && yarn install && cd ..
```

**3. Create your `.env` file** (see [Section 4](#4-environment-variables-reference) for all variables)
```bash
cp .env.example .env
# Edit .env with your values
```

**4. Configure AWS credentials** (required for AI/NPC features)

Either use the AWS CLI:
```bash
aws configure
# Enter your AWS Access Key ID, Secret Access Key, and region (us-east-1)
```

Or add directly to `.env`:
```
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=us-east-1
```

---

## 2. Docker Compose Services

The `docker-compose.yml` at the project root defines four services:

### `skyoffice` (Application Server)
- Builds from `Dockerfile` in the project root
- Exposes port `80` → maps to internal port `2567`
- Runs Express + Colyseus game server
- Depends on `postgres` being healthy before starting
- Serves the built React client as static files from `client/dist`

### `postgres` (Database)
- Image: `pgvector/pgvector:pg16` — PostgreSQL 16 with pgvector extension pre-installed
- **Not exposed** to the host machine (internal only, port 5432 inside Docker network)
- Data persisted in Docker volume `pgdata`
- Health check runs `pg_isready` every 5 seconds

### `peerjs` (WebRTC Signalling Server)
- Image: `peerjs/peerjs-server`
- Runs on internal port `9000` at path `/peerjs`
- **Not exposed** directly — the `skyoffice` service proxies `/peerjs` requests to it
- Handles WebRTC peer discovery and connection negotiation

### `coturn` (TURN Relay Server)
- Image: `coturn/coturn`
- Exposes UDP/TCP port `3478` (STUN/TURN) and UDP relay ports `49152-49200`
- **You must open these ports in your firewall/security group for WebRTC to work on remote deployments**
- Credentials: username `nexvoffice`, password from `TURN_PASSWORD` env var

---

## 3. Database Setup

Migrations and seeding run **automatically on server startup** — you do not need to run them manually in most cases.

### What happens on startup

1. **Migrations** (`server/db/migrate.ts`): Drizzle ORM applies any pending schema migrations from `server/db/migrations/`
2. **Admin seed** (`server/db/seed.ts`): If no users exist, creates the admin account:
   - Username: `admin`
   - Password: `changeme`
   - Role: `admin`
   - `mustChangePassword` flag set to `true`
3. **Default layout seed**: If no office layout exists, seeds the default 5×4 grid with 6 rooms and a public chat channel
4. **Room templates seed**: If no templates exist, seeds all 8 built-in room templates

### Manual migration (if needed)

```bash
# From project root
npx drizzle-kit generate   # generate migration SQL from schema changes
npx drizzle-kit migrate    # apply pending migrations
```

### Resetting the database

```bash
# Stop containers and remove volume (ALL DATA LOST)
docker compose down -v

# Restart — migrations + seed will re-run automatically
docker compose up
```

---

## 4. Environment Variables Reference

Create a `.env` file in the project root:

```env
# ── Database ──────────────────────────────────────────────────────────────────
DB_PASSWORD=nexvoffice_dev          # PostgreSQL password (change in production)

# ── Authentication ────────────────────────────────────────────────────────────
JWT_SECRET=nexvoffice_dev_secret    # JWT signing secret (use a long random string in prod)

# ── WebRTC / TURN ─────────────────────────────────────────────────────────────
TURN_PASSWORD=nexvoffice_dev        # Coturn credential password
TURN_USERNAME=nexvoffice            # Coturn credential username

# ── AWS Bedrock ───────────────────────────────────────────────────────────────
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=us-east-1                # Must be a region where Nova Pro + Titan Embed are available

# ── Application ───────────────────────────────────────────────────────────────
PORT=2567                           # Internal server port (Docker maps 80→2567)
```

**Production recommendations:**
- Generate a strong `JWT_SECRET`: `openssl rand -base64 64`
- Use a strong `DB_PASSWORD` and `TURN_PASSWORD`
- Never commit `.env` to version control

---

## 5. Starting the Application

### Development (local, no Docker)

```bash
# Terminal 1: Start backing services only
docker compose up postgres peerjs coturn

# Terminal 2: Start the server
yarn dev

# Terminal 3: Start the client dev server
cd client && yarn dev
```

Client runs at `http://localhost:5173`, server at `ws://localhost:2567`.

### Full Docker (production-like)

```bash
# Build and start everything
docker compose up --build

# Run in background
docker compose up --build -d

# View logs
docker compose logs -f skyoffice

# Stop everything
docker compose down
```

The application will be available at `http://localhost` (port 80).

---

## 6. Admin Panel Guide

### 6.1 Accessing the Admin Panel

1. Open the application in your browser
2. Log in with username `admin` / password `changeme`
3. You will be prompted to change your password on first login
4. After logging in and entering the office, click the **Admin** button in the bottom-right helper button group
5. The Admin Panel opens as a full-page view replacing the game (click "Back to Office" to return)

> **Note:** The Admin button is only visible to users with the `admin` role.

### 6.2 User Management

The User Management tab lets you create, view, and manage all user accounts.

#### Creating a new user

1. In the Admin Panel, go to the **Users** tab
2. Click **Create User**
3. Fill in:
   - **Username** (3–50 characters, letters/numbers/underscores only)
   - **Display Name** (shown in-game above the avatar)
   - **Password** (minimum 6 characters)
   - **Role**: `member` (default) or `admin`
   - **Avatar**: select from the available character sprites
4. Click **Save**
5. Share the credentials with the user — they can change their password after logging in

#### Managing existing users

- **Deactivate**: Toggle the `isActive` flag off. Deactivated users cannot log in. Their history is preserved.
- **Reset password**: Set a new temporary password and enable `mustChangePassword` so the user is forced to change it on next login
- **Promote to admin**: Change the user's role to `admin`

#### Important notes

- You cannot delete users (only deactivate) to preserve chat history and task assignments
- There must always be at least one active admin account
- Usernames are unique and cannot be changed after creation

### 6.3 Office Layout Editor

The Layout Editor lets you design the office floor plan by placing room tiles on a grid.

#### Understanding the grid system

- The office is a grid measured in **blocks**
- Each block = one room template footprint (e.g., a 1×1 block template occupies one grid cell)
- Some templates span multiple blocks (e.g., `Lobby` is 2×1 blocks, `Open Desk Area` is 2×2 blocks)
- The default layout is a **5×4 grid** (5 columns × 4 rows)
- Grid coordinates start at (0,0) top-left

#### Configuring grid size

1. In the Admin Panel, go to the **Layout** tab
2. Set **Grid Width** and **Grid Height** (minimum 1×1, recommended 4×6 or larger for comfortable offices)
3. Changes take effect when you save the layout

#### Placing rooms

1. Select a **Room Template** from the template panel on the right
2. Click a grid cell to place the template at that position
3. Multi-block templates will occupy multiple cells automatically — ensure enough space is available
4. Optionally set a **Room Name** for each placement (e.g., "Marketing Hub", "Dev Cave")
   - This name appears in the in-game Room Indicator HUD and chat room tabs
5. The editor prevents overlapping placements

#### Removing rooms

- Click on a placed room and press **Remove**, or click the X on the placement card

#### Saving the layout

- Click **Save Layout**
- The server validates all placements (checks template IDs exist and no overlaps)
- **Existing placements are replaced entirely** — the save is a full replace, not a merge
- Changes take effect immediately — players already in the office will see the updated layout on their next room transition (a server restart may be needed for map tile changes to fully propagate)

#### Layout constraints

- Two placements cannot share the same (gridX, gridY) origin cell
- Multi-block overlap detection is simplified — place large templates carefully
- The layout is stored in the `office_layout` and `room_placements` database tables

### 6.4 NPC Setup

NPCs (Non-Player Characters) are AI agents that players can converse with in the office. There are two NPC types:

| Type | Description |
|------|-------------|
| `agent` | Fully AI-powered NPC using AWS Bedrock Nova Pro. Responds intelligently using its system prompt and knowledge base. |
| `ghost` | Decorative NPC with scripted responses only (no live AI calls). Useful for ambient presence without AWS costs. |

#### Creating an NPC

1. In the Admin Panel, go to the **NPCs** tab
2. Click **Create NPC**
3. Fill in the required fields:

   **Name** — The display name shown above the NPC in-game (e.g., "HR Assistant", "Code Reviewer")

   **Type** — `agent` (AI-powered) or `ghost` (scripted)

   **Avatar** — Select from the available character sprites (must match a valid sprite name)

   **System Prompt** — This is the NPC's personality and role definition. Write it in natural language:
   ```
   You are a helpful HR assistant at NexV Corp. You help employees with:
   - Leave requests and holiday policies
   - Onboarding questions
   - Benefits information
   Always be professional, friendly, and concise. If you don't know something,
   say so and suggest the employee contact HR directly.
   ```

   **Greeting** — The message the NPC says when a player starts a conversation (default: "Hello! How can I help you?")

   **Spawn Coordinates** — Pixel coordinates (X, Y) where the NPC appears on the map:
   - Default map is approximately 1600×1280 pixels (5 blocks × 32px/tile × 10 tiles)
   - Use the Room Template's `npcSpawnPoints` as reference (see Section 9)
   - Example: X=176, Y=144 places the NPC in the centre of a 10×10 tile room at block (0,0)

   **Room Placement** — (Optional) Link the NPC to a specific room placement ID. This affects zone-based meeting mentions.

4. Click **Save**

#### Uploading knowledge to an NPC

Knowledge documents give the NPC context to answer domain-specific questions (RAG — Retrieval-Augmented Generation).

1. Go to the NPC's detail page in the Admin Panel
2. Click **Upload Knowledge**
3. Paste or type the document text (plain text, up to 100,000 characters per upload)
4. Optionally set a **Source Path** label (e.g., `hr-policy-2026.txt`) for tracking
5. Click **Upload**

The server will:
- Split the text into chunks
- Generate vector embeddings using AWS Titan Embed
- Store the embeddings in PostgreSQL (pgvector)

When a player sends a message to this NPC, the system retrieves the most relevant chunks and includes them in the AI prompt automatically.

**You can upload multiple documents** — all knowledge accumulates for that NPC.

#### NPC behaviors

NPCs run a behavior tick every 500ms. The behavior is set per NPC:

| Behavior | Description |
|----------|-------------|
| `stay_at_desk` | NPC stays at its spawn position (default) |
| `wander_room` | NPC moves randomly within its assigned room bounds |
| `wander_freely` | NPC moves randomly across the entire map |

When a player starts a conversation, the NPC automatically faces toward that player.

#### NPC heartbeat

Every 30 seconds, the NPC engine checks if any NPCs have lost their game state and re-spawns them automatically. This handles edge cases like server-side room restarts.

#### Deactivating an NPC

- Use the **Deactivate** button on the NPC card
- The NPC is soft-deleted (`isActive = false`) — it stops spawning but its knowledge and history are preserved
- To restore: re-activate via the API (admin panel restore button, if built) or directly in the database

### 6.5 Office Settings

Office Settings control gameplay parameters.

#### Beat Damage

The "beat" mechanic allows players to deal HP damage to each other when in close proximity.

| Setting Key | Default | Description |
|-------------|---------|-------------|
| `beat_damage` | `10` | HP damage per beat action |

To change beat damage:
1. Go to **Settings** tab in the Admin Panel
2. Set **Beat Damage** value (integer, 1–100)
3. Click **Save**

**Other HP parameters** (stored in `playerStats` table):
- Default `maxHp`: 100
- HP resets daily via a cron job (`server/gamification/hp-reset.ts`)
- Proximity threshold for beat: 96 pixels
- Beat cooldown: 3 seconds per attacker

---

## 7. AWS Bedrock Setup

NexVOffice uses two AWS Bedrock models:

| Model | ID | Purpose |
|-------|----|---------|
| Amazon Nova Pro | `us.amazon.nova-pro-v1:0` | NPC chat responses |
| Amazon Titan Embed Text v2 | `amazon.titan-embed-text-v2:0` | Knowledge embeddings (1024 dimensions) |

### Step 1: Enable model access

1. Log in to the [AWS Console](https://console.aws.amazon.com)
2. Navigate to **Amazon Bedrock** → **Model access**
3. Request access to:
   - `Amazon Nova Pro`
   - `Amazon Titan Embed Text v2`
4. Wait for approval (usually instant for most regions)

### Step 2: Set the correct region

Both models must be available in the region specified by `AWS_REGION`. Recommended region: **`us-east-1`** (US East, N. Virginia) — it has the broadest model availability.

Note: Nova Pro uses the cross-region inference prefix `us.` in its model ID (`us.amazon.nova-pro-v1:0`). This is intentional and required.

### Step 3: Configure IAM permissions

The AWS credentials used must have the following IAM policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": [
        "arn:aws:bedrock:us-east-1::foundation-model/us.amazon.nova-pro-v1:0",
        "arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v2:0"
      ]
    }
  ]
}
```

### Step 4: Set environment variables

```env
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
```

### Rate limiting

The AI gateway enforces:
- **Per-user rate limit**: 1 request per 3 seconds
- **Concurrency limit**: Max 3 simultaneous Bedrock requests (queued with 30s timeout)

If `AWS_REGION` or credentials are missing/invalid, NPC conversations will fail silently with an error in server logs.

### Testing Bedrock connectivity

```bash
# From inside the running container
docker compose exec skyoffice node -e "
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });
const cmd = new InvokeModelCommand({
  modelId: 'amazon.titan-embed-text-v2:0',
  contentType: 'application/json',
  accept: 'application/json',
  body: JSON.stringify({ inputText: 'test', dimensions: 1024, normalize: true }),
});
client.send(cmd).then(r => console.log('Bedrock OK')).catch(e => console.error('Bedrock FAIL:', e.message));
"
```

---

## 8. WebRTC & Voice Setup

### Overview

Voice and video use a two-tier approach:
1. **PeerJS** — peer-to-peer WebRTC signalling (works for same-network or direct internet connections)
2. **Coturn** — TURN relay server for NAT traversal (required when peers cannot connect directly)

### Port requirements

| Port | Protocol | Service | Required? |
|------|----------|---------|----------|
| 80 or 443 | TCP | Application (HTTP/WS) | Yes |
| 3478 | UDP + TCP | Coturn STUN/TURN | Yes for remote deployment |
| 49152–49200 | UDP | Coturn media relay | Yes for remote deployment |

**Firewall / Security Group rules** (for cloud deployments):
```
Inbound:  TCP 80 (or 443), UDP 3478, TCP 3478, UDP 49152-49200
Outbound: All (or mirror of inbound)
```

### TURN credentials

Coturn uses long-term credentials:
- Username: `nexvoffice` (or value of `TURN_USERNAME`)
- Password: value of `TURN_PASSWORD` env var

The client fetches TURN credentials from `GET /api/turn-credentials` (authenticated endpoint).

### Voice zones

Voice chat is scoped to zones. Players only hear others in the same room zone. When a player enters a zone, the server sends `ZONE_MEMBERS` with a list of peer session IDs — the client then initiates PeerJS connections to each.

### Disabling voice (if not needed)

If you don't need voice/video, you can skip the coturn service:
```bash
docker compose up skyoffice postgres peerjs
```
Players will still be able to text-chat. Voice calls will fail gracefully.

### SSL and TURN

For production with HTTPS, coturn should also use TLS. The current config uses `--no-tls --no-dtls` for simplicity. For production:
1. Obtain an SSL certificate (e.g., Let's Encrypt)
2. Update the coturn command to use `--cert` and `--pkey` options
3. Update the client's TURN URL to use `turns:` protocol

---

## 9. Room Templates Reference

There are 8 built-in room templates. Each block = 1 grid cell in the layout editor (one block = 10×10 tiles = 320×320 pixels at 32px/tile).

### Lobby (2×1 blocks)
- **Category**: common
- **Features**: none (no voice, no screenshare, no whiteboard, no private chat)
- **Items**: 2 chairs, 1 vending machine
- **NPC spawn point**: Receptionist at centre (x=240, y=176)
- **Use**: Main entrance area for all players to gather

### Meeting Room S (1×1 block)
- **Category**: meeting
- **Features**: voice, screenshare, whiteboard, private room chat
- **Items**: 1 whiteboard, 5 chairs
- **Use**: Small focused meetings (2–5 people)

### Meeting Room M (1×2 blocks)
- **Category**: meeting
- **Features**: voice, screenshare, whiteboard, private room chat
- **Items**: 1 whiteboard, 6 chairs
- **Use**: Medium meetings (up to ~8 people)

### Meeting Room L (2×2 blocks)
- **Category**: meeting
- **Features**: voice, screenshare, whiteboard, private room chat
- **Items**: 2 whiteboards, 6 chairs
- **Use**: Large all-hands or workshop sessions

### Open Desk Area (2×2 blocks)
- **Category**: workspace
- **Features**: none (open floor — no voice isolation or private chat)
- **Items**: 8 computers, 8 chairs (4 per row, 2 rows)
- **Use**: Shared open-plan workspace for daily work

### Break Room (1×1 block)
- **Category**: social
- **Features**: voice only
- **Items**: 2 vending machines, 4 chairs
- **Use**: Casual social area — players can voice-chat while taking a break

### NPC Office (1×1 block)
- **Category**: npc
- **Features**: private chat only
- **Items**: 1 computer, 2 chairs
- **NPC spawn point**: NPC at centre (x=176, y=144)
- **Use**: Dedicated room for AI NPC interactions (e.g., HR bot, help desk)

### Hallway H (1×1 block)
- **Category**: connector
- **Features**: none
- **Items**: none
- **Use**: Horizontal corridor to connect rooms visually

### Hallway V (1×1 block)
- **Category**: connector
- **Features**: none
- **Items**: none
- **Use**: Vertical corridor to connect rooms visually

---

## 10. Production Deployment

### Docker build

```bash
# Build production image
docker compose build

# Or with explicit tag
docker build -t nexvoffice:latest .
```

### nginx reverse proxy with SSL

Example nginx configuration for a domain `office.yourdomain.com`:

```nginx
server {
    listen 80;
    server_name office.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name office.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/office.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/office.yourdomain.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # HTTP proxy (REST API + static files)
    location / {
        proxy_pass         http://localhost:80;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_read_timeout 3600s;
    }
}
```

Then update `docker-compose.yml` (or a production override file) to not expose port 80 directly and let nginx handle the routing.

### Production environment checklist

- [ ] Strong `JWT_SECRET` (64+ random characters)
- [ ] Strong `DB_PASSWORD` and `TURN_PASSWORD`
- [ ] AWS credentials with minimal IAM permissions (Bedrock only)
- [ ] Firewall rules: ports 443, 3478 UDP/TCP, 49152-49200 UDP open
- [ ] SSL certificate configured (Let's Encrypt recommended)
- [ ] `docker compose up -d` with restart policy `unless-stopped` (already set)
- [ ] Log rotation configured for Docker (`/etc/docker/daemon.json` → `log-driver: json-file`, `max-size: 50m`)
- [ ] Database backup strategy (pg_dump or Docker volume snapshot)

### Building the client for production

The `Dockerfile` runs `cd client && yarn build` which outputs to `client/dist`. The Express server serves this directory as static files. No separate client deployment is needed.

---

## 11. Troubleshooting

### Application won't start

**Symptom**: `skyoffice` container exits immediately

```bash
docker compose logs skyoffice
```

Common causes:
- `DATABASE_URL` is wrong or postgres container is not healthy yet — check `depends_on` and healthcheck
- Migration failure — check if `pgvector` extension is available (should be included in the `pgvector/pgvector:pg16` image)
- Missing env vars causing runtime errors

**Fix**: Ensure postgres is healthy before the app starts. The healthcheck retries 5 times at 5s intervals.

### Colyseus Monitor (Real-time Room Inspection)

The Colyseus monitor is accessible at:
```
http://localhost/colyseus
```
(Requires admin login — `authMiddleware` + `adminOnly` is applied)

Use it to:
- Inspect active rooms and their state
- See connected clients and their session data
- Force-disconnect clients
- View room metadata

### Database issues

**Connect to postgres directly:**
```bash
docker compose exec postgres psql -U nexvoffice -d nexvoffice
```

**Common queries:**
```sql
-- List all users
SELECT id, username, role, is_active FROM users;

-- List room placements
SELECT rp.grid_x, rp.grid_y, rt.name, rp.room_name
FROM room_placements rp
JOIN room_templates rt ON rp.template_id = rt.id;

-- List NPCs
SELECT id, name, type, is_active, spawn_x, spawn_y FROM npc_agents;

-- Check office settings
SELECT key, value FROM office_settings;

-- Count embeddings per NPC
SELECT npc_id, COUNT(*) FROM npc_embeddings GROUP BY npc_id;
```

**pgvector extension missing:**
```sql
-- Run this if embeddings fail to store
CREATE EXTENSION IF NOT EXISTS vector;
```

### WebRTC / Voice not working

1. **Players on the same machine**: Should work with just PeerJS (no TURN needed)
2. **Players on different networks**: Coturn TURN is required — verify ports 3478 and 49152-49200 are open
3. **Check browser console**: Look for `RTCPeerConnection` errors
4. **Verify TURN credentials**: Call `GET /api/turn-credentials` with a valid JWT — should return `{ username, credential }`
5. **Check coturn logs**: `docker compose logs coturn`

### NPC not responding / AI errors

1. **Check AWS credentials**: Verify `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are set correctly
2. **Check model access**: Ensure Nova Pro and Titan Embed are enabled in your AWS region
3. **Rate limiting**: Users are limited to 1 AI request per 3 seconds — wait and retry
4. **Check server logs**: `docker compose logs skyoffice | grep -i "npc\|bedrock\|AI"`
5. **No NPC spawned**: Verify the NPC has `isActive = true` and valid `spawnX`/`spawnY` coordinates

### Admin button not visible

- Confirm the logged-in user has `role = 'admin'` in the database
- Check `GET /api/users/me` returns `"role": "admin"`
- Try logging out and back in to refresh the JWT

### HP not resetting

- The daily HP reset runs via a cron job (`startHpResetCron`)
- Verify the cron is running: check server logs for `[HP Reset]` entries
- Manually reset: `UPDATE player_stats SET hp = max_hp;` in psql

### Port conflicts

If port 80 is already in use:
```yaml
# In docker-compose.yml, change:
ports:
  - "8080:2567"  # use port 8080 instead
```

Then access the app at `http://localhost:8080`.
