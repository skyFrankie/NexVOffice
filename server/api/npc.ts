import { Router } from 'express'
import { db } from '../db/connection'
import { npcAgents, npcKnowledgeSources, npcMcpConnections, npcToolPermissions } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import { authMiddleware, adminOnly } from '../auth/middleware'
import { indexDocument } from '../npc/rag'
import { discoverTools } from '../npc/mcp-client'

const router = Router()

router.use(authMiddleware)

// GET /api/npcs — list NPCs (admin sees all, others see active only)
router.get('/', async (req, res) => {
  const isAdmin = req.user!.role === 'admin'
  const query = db
    .select({
      id: npcAgents.id,
      name: npcAgents.name,
      type: npcAgents.type,
      avatar: npcAgents.avatar,
      systemPrompt: npcAgents.systemPrompt,
      greeting: npcAgents.greeting,
      spawnX: npcAgents.spawnX,
      spawnY: npcAgents.spawnY,
      isActive: npcAgents.isActive,
      createdAt: npcAgents.createdAt,
    })
    .from(npcAgents)

  const result = isAdmin ? await query : await query.where(eq(npcAgents.isActive, true))
  res.json(result)
})

// POST /api/npcs — create NPC (admin only)
router.post('/', adminOnly, async (req, res) => {
  const { name, type, avatar, systemPrompt, greeting, spawnX, spawnY, roomPlacementId } = req.body

  if (!name || !avatar || !systemPrompt) {
    return res.status(400).json({ error: 'name, avatar, and systemPrompt are required' })
  }

  const result = await db
    .insert(npcAgents)
    .values({
      name,
      type: type || 'agent',
      avatar,
      systemPrompt,
      greeting: greeting || 'Hello! How can I help you?',
      spawnX: spawnX ?? null,
      spawnY: spawnY ?? null,
      roomPlacementId: roomPlacementId ?? null,
    })
    .returning()

  res.status(201).json(result[0])
})

// PUT /api/npcs/:id — update NPC (admin only)
router.put('/:id', adminOnly, async (req, res) => {
  const { id } = req.params
  const { name, avatar, systemPrompt, greeting, spawnX, spawnY, roomPlacementId } = req.body

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (name !== undefined) updates.name = name
  if (avatar !== undefined) updates.avatar = avatar
  if (systemPrompt !== undefined) updates.systemPrompt = systemPrompt
  if (greeting !== undefined) updates.greeting = greeting
  if (spawnX !== undefined) updates.spawnX = spawnX
  if (spawnY !== undefined) updates.spawnY = spawnY
  if (roomPlacementId !== undefined) updates.roomPlacementId = roomPlacementId

  await db.update(npcAgents).set(updates).where(eq(npcAgents.id, id))
  res.json({ success: true })
})

// DELETE /api/npcs/:id — soft deactivate (admin only)
router.delete('/:id', adminOnly, async (req, res) => {
  const { id } = req.params
  await db
    .update(npcAgents)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(npcAgents.id, id))
  res.json({ success: true })
})

// POST /api/npcs/:id/knowledge — upload knowledge document (admin only)
router.post('/:id/knowledge', adminOnly, async (req, res) => {
  const { id } = req.params
  const { text, sourcePath, sourceType } = req.body

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text body is required' })
  }
  if (text.length === 0) {
    return res.status(400).json({ error: 'text cannot be empty' })
  }
  if (text.length > 100_000) {
    return res.status(413).json({ error: 'Text exceeds maximum length of 100000 characters' })
  }

  // Verify NPC exists
  const npc = await db.select().from(npcAgents).where(eq(npcAgents.id, id)).limit(1)
  if (npc.length === 0) {
    return res.status(404).json({ error: 'NPC not found' })
  }

  // Create knowledge source record
  const source = await db
    .insert(npcKnowledgeSources)
    .values({
      npcId: id,
      sourceType: sourceType || 'text',
      sourcePath: sourcePath || 'manual-upload',
    })
    .returning()

  const chunkCount = await indexDocument(id, source[0].id, text)
  res.status(201).json({ sourceId: source[0].id, chunkCount })
})

// GET /api/npcs/:id/tools — list MCP tools for NPC
router.get('/:id/tools', async (req, res) => {
  const { id } = req.params

  const connections = await db
    .select()
    .from(npcMcpConnections)
    .where(and(eq(npcMcpConnections.npcId, id), eq(npcMcpConnections.isActive, true)))

  const allTools: Array<{ connectionId: string; tools: unknown[] }> = []
  for (const conn of connections) {
    const tools = await discoverTools(conn.id)
    allTools.push({ connectionId: conn.id, tools })
  }

  res.json(allTools)
})

export default router
