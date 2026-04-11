import { db } from '../db/connection'
import { npcAgents, chatChannels, chatMessages, users } from '../db/schema'
import { eq } from 'drizzle-orm'
import { aiGateway, AIMessage } from './ai-gateway'
import { queryKnowledge } from './rag'
import { buildPrompt } from './prompt-builder'
import { callTool, discoverTools, MCPTool } from './mcp-client'
import { npcMcpConnections, npcToolPermissions } from '../db/schema'
import { and } from 'drizzle-orm'

const IDLE_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes
const MAX_HISTORY = 20
const RATE_LIMIT_MS = 3000
const MAX_CONTENT_LENGTH = 500

interface ConversationSession {
  npcId: string
  userId: string
  history: AIMessage[]
  lastActivityAt: number
  idleTimer: ReturnType<typeof setTimeout>
  npcChannelId: string | null
}

// sessionId = `${npcId}:${userId}`
const sessions = new Map<string, ConversationSession>()
const userLastMessage = new Map<string, number>()

type OnEndCallback = (sessionId: string) => void
let onEndCallback: OnEndCallback | null = null

export function setOnEndCallback(cb: OnEndCallback) {
  onEndCallback = cb
}

function makeSessionId(npcId: string, userId: string): string {
  return `${npcId}:${userId}`
}

function resetIdleTimer(session: ConversationSession, sessionId: string) {
  clearTimeout(session.idleTimer)
  session.idleTimer = setTimeout(() => {
    endConversation(sessionId).catch((err) =>
      console.error('Auto-end conversation error:', err)
    )
  }, IDLE_TIMEOUT_MS)
}

export async function startConversation(
  npcId: string,
  userId: string
): Promise<{ sessionId: string; greeting: string }> {
  const sessionId = makeSessionId(npcId, userId)

  // End any existing session for this pair
  if (sessions.has(sessionId)) {
    await endConversation(sessionId)
  }

  const npcs = await db.select().from(npcAgents).where(eq(npcAgents.id, npcId)).limit(1)
  if (npcs.length === 0) throw new Error('NPC not found')
  const npc = npcs[0]

  // Create or find NPC chat channel
  let npcChannelId: string | null = null
  try {
    const existing = await db
      .select({ id: chatChannels.id })
      .from(chatChannels)
      .where(and(eq(chatChannels.type, 'npc'), eq(chatChannels.roomId, npcId as any)))
      .limit(1)
    if (existing.length > 0) {
      npcChannelId = existing[0].id
    } else {
      const created = await db
        .insert(chatChannels)
        .values({ type: 'npc', name: `npc:${npc.name}` })
        .returning({ id: chatChannels.id })
      npcChannelId = created[0].id
    }
  } catch {
    // non-fatal
  }

  const idleTimer = setTimeout(() => {
    endConversation(sessionId).catch((err) =>
      console.error('Auto-end conversation error:', err)
    )
  }, IDLE_TIMEOUT_MS)

  sessions.set(sessionId, {
    npcId,
    userId,
    history: [],
    lastActivityAt: Date.now(),
    idleTimer,
    npcChannelId,
  })

  return { sessionId, greeting: npc.greeting }
}

export async function handleMessage(
  sessionId: string,
  userMessage: string
): Promise<string> {
  const session = sessions.get(sessionId)
  if (!session) throw new Error('No active conversation session')

  // Rate limiting per user
  const now = Date.now()
  const lastMsg = userLastMessage.get(session.userId) ?? 0
  if (now - lastMsg < RATE_LIMIT_MS) {
    throw new Error('Rate limit: 1 message per 3 seconds')
  }
  userLastMessage.set(session.userId, now)

  if (userMessage.length > MAX_CONTENT_LENGTH) {
    userMessage = userMessage.slice(0, MAX_CONTENT_LENGTH)
  }

  const npcs = await db
    .select()
    .from(npcAgents)
    .where(eq(npcAgents.id, session.npcId))
    .limit(1)
  if (npcs.length === 0) throw new Error('NPC not found')
  const npc = npcs[0]

  // Look up user context
  const userRows = await db
    .select({ displayName: users.displayName, role: users.role })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1)
  const userContext = userRows[0] ?? { displayName: 'User', role: 'member' }

  // RAG retrieval
  let ragChunks: string[] = []
  try {
    ragChunks = await queryKnowledge(session.npcId, userMessage)
  } catch {
    // non-fatal
  }

  // Discover tools for agent NPCs
  let tools: MCPTool[] = []
  if (npc.type === 'agent') {
    try {
      const connections = await db
        .select()
        .from(npcMcpConnections)
        .where(and(eq(npcMcpConnections.npcId, session.npcId), eq(npcMcpConnections.isActive, true)))
      for (const conn of connections) {
        const connTools = await discoverTools(conn.id)
        tools.push(...connTools)
      }
    } catch {
      // non-fatal
    }
  }

  // Add user message to history
  session.history.push({ role: 'user', content: userMessage })

  // Trim history to last MAX_HISTORY messages
  if (session.history.length > MAX_HISTORY) {
    session.history = session.history.slice(session.history.length - MAX_HISTORY)
  }

  const { systemPrompt, messages } = buildPrompt(
    { id: npc.id, name: npc.name, type: npc.type, systemPrompt: npc.systemPrompt, greeting: npc.greeting },
    session.history,
    ragChunks,
    tools,
    { id: session.userId, displayName: userContext.displayName, role: userContext.role }
  )

  let responseText: string

  try {
    const aiResponse = await aiGateway.chat(systemPrompt, messages, tools.length > 0 ? tools : undefined, undefined, session.userId)

    if (aiResponse.toolUse && npc.type === 'agent') {
      // Find which connection owns this tool
      const connections = await db
        .select()
        .from(npcMcpConnections)
        .where(and(eq(npcMcpConnections.npcId, session.npcId), eq(npcMcpConnections.isActive, true)))

      let toolResult: unknown = null
      for (const conn of connections) {
        const allowed = await db
          .select()
          .from(npcToolPermissions)
          .where(
            and(
              eq(npcToolPermissions.mcpConnectionId, conn.id),
              eq(npcToolPermissions.toolName, aiResponse.toolUse.toolName),
              eq(npcToolPermissions.isAllowed, true)
            )
          )
          .limit(1)
        if (allowed.length > 0) {
          toolResult = await callTool(conn.id, aiResponse.toolUse.toolName, aiResponse.toolUse.toolInput, session.userId)
          break
        }
      }

      // Feed tool result back to get final response
      const toolResultMessages: AIMessage[] = [
        ...messages,
        { role: 'assistant', content: `Tool ${aiResponse.toolUse.toolName} called` },
        { role: 'user', content: `Tool result: ${JSON.stringify(toolResult)}` },
      ]
      const finalResponse = await aiGateway.chat(systemPrompt, toolResultMessages)
      responseText = finalResponse.content
    } else {
      responseText = aiResponse.content
    }
  } catch (err) {
    console.error('AI pipeline error:', err)
    responseText = "I'm having trouble thinking right now. Please try again in a moment."
  }

  // Add assistant response to history
  session.history.push({ role: 'assistant', content: responseText })

  // Reset idle timer
  session.lastActivityAt = Date.now()
  resetIdleTimer(session, sessionId)

  return responseText
}

export async function endConversation(sessionId: string): Promise<void> {
  const session = sessions.get(sessionId)
  if (!session) return

  clearTimeout(session.idleTimer)
  sessions.delete(sessionId)

  if (onEndCallback) {
    onEndCallback(sessionId)
  }
}

export function hasSession(sessionId: string): boolean {
  return sessions.has(sessionId)
}
