import { Router } from 'express'
import bcrypt from 'bcrypt'
import { db } from '../db/connection'
import { users } from '../db/schema'
import { eq } from 'drizzle-orm'
import { authMiddleware, adminOnly } from '../auth/middleware'
import { config } from '../config'

const router = Router()

// All routes require auth
router.use(authMiddleware)

// List users (any authenticated user)
router.get('/', async (req, res) => {
  const result = await db.select({
    id: users.id,
    username: users.username,
    displayName: users.displayName,
    avatar: users.avatar,
    role: users.role,
    isActive: users.isActive,
    createdAt: users.createdAt,
  }).from(users)
  res.json(result)
})

// Create user (admin only)
router.post('/', adminOnly, async (req, res) => {
  const { username, password, displayName, avatar, role } = req.body
  if (!username || !password || !displayName) {
    return res.status(400).json({ error: 'username, password, and displayName required' })
  }

  const existing = await db.select().from(users).where(eq(users.username, username)).limit(1)
  if (existing.length > 0) {
    return res.status(409).json({ error: 'Username already exists' })
  }

  const hash = await bcrypt.hash(password, config.bcryptRounds)
  const result = await db.insert(users).values({
    username,
    passwordHash: hash,
    displayName,
    avatar: avatar || 'adam',
    role: role || 'member',
    mustChangePassword: true,
  }).returning({
    id: users.id,
    username: users.username,
    displayName: users.displayName,
    avatar: users.avatar,
    role: users.role,
    isActive: users.isActive,
    createdAt: users.createdAt,
  })

  res.status(201).json(result[0])
})

// Update user (admin: any user, member: self only)
router.put('/:id', async (req, res) => {
  const { id } = req.params
  if (req.user!.role !== 'admin' && req.user!.id !== id) {
    return res.status(403).json({ error: 'Can only update your own profile' })
  }

  const { displayName, avatar, role, password, isActive } = req.body
  const updates: Record<string, any> = { updatedAt: new Date() }
  if (displayName) updates.displayName = displayName
  if (avatar) updates.avatar = avatar

  // Admin-only fields
  if (req.user!.role === 'admin') {
    if (role && (role === 'admin' || role === 'member')) updates.role = role
    if (isActive !== undefined) updates.isActive = isActive
  }

  // Password update (admin can reset any, member can change own)
  if (password && typeof password === 'string' && password.length >= 6) {
    updates.passwordHash = await bcrypt.hash(password, config.bcryptRounds)
  }

  await db.update(users).set(updates).where(eq(users.id, id))

  const updated = await db.select({
    id: users.id,
    username: users.username,
    displayName: users.displayName,
    avatar: users.avatar,
    role: users.role,
    isActive: users.isActive,
    createdAt: users.createdAt,
  }).from(users).where(eq(users.id, id)).limit(1)

  res.json(updated[0])
})

// Deactivate user (admin only)
router.delete('/:id', adminOnly, async (req, res) => {
  const { id } = req.params
  if (req.user!.id === id) {
    return res.status(400).json({ error: 'Cannot deactivate yourself' })
  }

  await db.update(users).set({ isActive: false, updatedAt: new Date() }).where(eq(users.id, id))
  res.json({ success: true })
})

export default router
