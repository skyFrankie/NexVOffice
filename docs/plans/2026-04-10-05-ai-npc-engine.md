# AI NPC Engine

**Date:** 2026-04-10
**Series:** NexVOffice Design Docs — Part 5 of 7

---

## NPC Types

| Aspect | Agent | Ghost |
|---|---|---|
| Knowledge (RAG) | Yes | Yes |
| MCP Tools | Yes — whitelisted per NPC | No |
| Behavior | Wander, go to meetings, face user | Fixed position, floating animation |
| Visual | Normal sprite + colored glow | Translucent (alpha 0.5) + gray glow |
| User token needed | Yes (for MCP calls) | No |

---

## NPC Engine Architecture

```
NPC Engine:
  NPC Manager        — loads NPCs from DB on boot, joins each as Colyseus client
  Behavior Controller — idle wander, summoned walk-to-meeting, face user when talking
  Conversation Manager — per user-NPC pair session, message history, context window, 5min idle timeout
  AI Gateway         — abstracts Bedrock API (Nova Pro model)
  RAG                — pgvector search, chunk retrieval
  MCP Router         — tool whitelist check, user token injection, MCP server calls
  Prompt Builder     — assembles system prompt + RAG context + conversation history + tools + user context
```

---

## Walk-up Conversation Flow

1. User walks near NPC → "Press R to talk to [NPC name]"
2. Press R → `START_NPC_CONVERSATION { npcId }`
3. Server creates conversation session, NPC faces user
4. Client opens `NPCDialog.tsx`
5. User types message → `NPC_MESSAGE { npcId, content }`
6. Server pipeline:
   a. Prompt Builder assembles: persona + RAG chunks (top 5) + conversation history + available tools + user context
   b. Calls Bedrock Nova Pro
   c. If `tool_use` returned: MCP Router checks whitelist → calls MCP with user's linked token → feeds result back
   d. Returns text response
7. `NPC_RESPONSE` → client shows with typing animation + speech bubble in game
8. ESC or walk away → `END_NPC_CONVERSATION`, conversation saved to `chat_messages`

---

## @mention in Meeting Flow

1. User types `@accountant what's our invoice total?` in room chat
2. `MENTION_NPC { npcId, content, roomId }`
3. Same AI pipeline but context includes meeting chat history + all participants
4. NPC "walks" to meeting room (behavior controller)
5. Response posted to room's `chat_channel` — all members see it

---

## Admin NPC Definition (7 steps)

1. **Basic Identity:** name, type (agent/ghost)
2. **Appearance:** pick from built-in sprites, visual modifiers (glow, transparency)
3. **Personality:** system prompt with templates (Financial Assistant, HR, IT Helpdesk, Custom)
4. **Knowledge Sources:** upload documents, add Obsidian vault path, add URLs → chunked → embedded → pgvector
5. **Tools/MCP (agent only):** MCP servers discovered from `.env` config, admin whitelists tools per NPC
6. **Placement:** pick room, click to place on mini map, behavior (stay at desk / wander room / wander freely), meeting availability toggle
7. **Ghost-specific:** former employee name, role, departure date, intro message

---

## Knowledge Indexing Pipeline

```
Admin uploads doc → server saves file
  → Chunk into ~500 token pieces with overlap
  → Bedrock Titan Embeddings (amazon.titan-embed-text-v2) per chunk
  → Store in npc_embeddings (pgvector)
  → Mark source as indexed

User query:
  → Embed question with Titan
  → pgvector: nearest 5 chunks (cosine distance)
  → Inject as context in prompt
```

---

## Bedrock Integration

```typescript
AIGateway:
  - client: BedrockRuntimeClient (@aws-sdk/client-bedrock-runtime)
  - Model: Nova Pro (amazon.nova-pro-v1:0) — good balance of speed/cost
  - Embeddings: Titan (amazon.titan-embed-text-v2)
  - Configurable per NPC in DB
  - chat(systemPrompt, messages, tools?, ragContext?) -> AIResponse
```

---

## MCP Router

```
When LLM returns tool_use:
  1. Look up tool_name in npc_tool_permissions -> check allowed
  2. If tool needs user context: get user's nexfina_token from users table
  3. Call MCP server (from npc_mcp_connections) with tool params + user token
  4. Return tool result to LLM for final answer
```

---

## Ghost Specialization

- Same NPC system with `agent_type='ghost'`
- Prompt Builder: persona + RAG only (no tools section)
- MCP Router: disabled
- Appearance: translucent sprite, gray glow
- Ghost intro message shown on first interaction
- Can be @mentioned in meetings same as agents

---

## Server File Structure

```
server/npc/
  engine.ts          — NPC bot manager, joins Colyseus as client
  behavior.ts        — Movement AI (idle wander, go-to-meeting)
  conversation.ts    — Dialog state per user-NPC pair
  ai-gateway.ts      — Bedrock API abstraction
  rag.ts             — pgvector search, chunk retrieval
  mcp-client.ts      — MCP protocol client for tool calls
  ghost.ts           — Ghost subclass, RAG only
```
