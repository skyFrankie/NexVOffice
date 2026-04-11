import { Router } from 'express'
import { authMiddleware } from '../auth/middleware'
import { db } from '../db/connection'
import { chatChannels, chatMessages, users } from '../db/schema'
import { eq, and, or, like, desc, lt } from 'drizzle-orm'

const router = Router()

router.use(authMiddleware)

// GET /api/chat/channels/public — must come before /:id routes
router.get('/channels/public', async (req, res) => {
  const results = await db
    .select({
      id: chatChannels.id,
      type: chatChannels.type,
      name: chatChannels.name,
      createdAt: chatChannels.createdAt,
    })
    .from(chatChannels)
    .where(eq(chatChannels.type, 'public'))
    .limit(1)

  if (results.length === 0) {
    return res.status(404).json({ error: 'Public channel not found' })
  }

  res.json({ channel: results[0] })
})

// POST /api/chat/channels/dm — must come before /:id routes
router.post('/channels/dm', async (req, res) => {
  const { targetUserId } = req.body
  if (!targetUserId || typeof targetUserId !== 'string') {
    return res.status(400).json({ error: 'targetUserId is required' })
  }
  const userId = req.user!.id
  if (targetUserId === userId) {
    return res.status(400).json({ error: 'Cannot create DM with yourself' })
  }

  const channelName = `dm:${[userId, targetUserId].sort().join(':')}`

  const existing = await db
    .select({
      id: chatChannels.id,
      type: chatChannels.type,
      name: chatChannels.name,
      createdAt: chatChannels.createdAt,
    })
    .from(chatChannels)
    .where(and(eq(chatChannels.type, 'dm'), eq(chatChannels.name, channelName)))
    .limit(1)

  if (existing.length > 0) {
    return res.json({ channel: existing[0] })
  }

  const created = await db
    .insert(chatChannels)
    .values({ type: 'dm', name: channelName })
    .returning({
      id: chatChannels.id,
      type: chatChannels.type,
      name: chatChannels.name,
      createdAt: chatChannels.createdAt,
    })

  res.status(201).json({ channel: created[0] })
})

// GET /api/chat/channels
router.get('/channels', async (req, res) => {
  const userId = req.user!.id
  const { roomId } = req.query

  const conditions = [
    eq(chatChannels.type, 'public'),
    and(eq(chatChannels.type, 'dm'), or(
      like(chatChannels.name, `dm:${userId}:%`),
      like(chatChannels.name, `dm:%:${userId}`)
    )),
  ]

  if (roomId && typeof roomId === 'string') {
    conditions.push(and(eq(chatChannels.type, 'room'), eq(chatChannels.roomId, roomId)))
  }

  const results = await db
    .select({
      id: chatChannels.id,
      type: chatChannels.type,
      name: chatChannels.name,
      roomId: chatChannels.roomId,
      createdAt: chatChannels.createdAt,
    })
    .from(chatChannels)
    .where(or(...conditions))

  res.json({ channels: results })
})

// GET /api/chat/channels/:id/messages
router.get('/channels/:id/messages', async (req, res) => {
  const { id } = req.params
  const userId = req.user!.id

  // Authorization: verify the requesting user has access to this channel
  const channel = await db
    .select({ id: chatChannels.id, type: chatChannels.type, name: chatChannels.name, roomId: chatChannels.roomId })
    .from(chatChannels)
    .where(eq(chatChannels.id, id))
    .limit(1)

  if (channel.length === 0) {
    return res.status(404).json({ error: 'Channel not found' })
  }

  const ch = channel[0]
  // DM channels: verify user is a participant (name contains their ID)
  if (ch.type === 'dm' && ch.name) {
    const parts = ch.name.split(':')
    if (!parts.includes(userId)) {
      return res.status(403).json({ error: 'Access denied' })
    }
  }

  const limit = Math.min(Number(req.query.limit) || 50, 100)
  const before = req.query.before as string | undefined

  const conditions = [eq(chatMessages.channelId, id)]

  if (before) {
    conditions.push(lt(chatMessages.createdAt, new Date(before)))
  }

  const rows = await db
    .select({
      id: chatMessages.id,
      senderId: chatMessages.senderId,
      senderName: users.displayName,
      content: chatMessages.content,
      createdAt: chatMessages.createdAt,
    })
    .from(chatMessages)
    .innerJoin(users, eq(chatMessages.senderId, users.id))
    .where(and(...conditions))
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit)

  // Return in ascending order (oldest first)
  rows.reverse()

  res.json({ messages: rows })
})

export default router
