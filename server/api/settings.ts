import { Router } from 'express'
import { db } from '../db/connection'
import { officeSettings } from '../db/schema'
import { eq } from 'drizzle-orm'
import { authMiddleware, adminOnly } from '../auth/middleware'

const router = Router()

router.use(authMiddleware)
router.use(adminOnly)

// List all settings
router.get('/', async (_req, res) => {
  const result = await db.select().from(officeSettings)
  res.json(result)
})

// Upsert a setting by key
router.put('/:key', async (req, res) => {
  const { key } = req.params
  if (!/^[a-zA-Z0-9_.-]{1,100}$/.test(key)) {
    return res.status(400).json({ error: 'Invalid key format (alphanumeric, underscores, dots, hyphens; max 100 chars)' })
  }
  const { value } = req.body
  if (value === undefined) {
    return res.status(400).json({ error: 'value required' })
  }

  const existing = await db.select().from(officeSettings).where(eq(officeSettings.key, key)).limit(1)
  if (existing.length > 0) {
    const result = await db
      .update(officeSettings)
      .set({ value, updatedAt: new Date() })
      .where(eq(officeSettings.key, key))
      .returning()
    return res.json(result[0])
  }

  const result = await db
    .insert(officeSettings)
    .values({ key, value })
    .returning()
  res.status(201).json(result[0])
})

// Delete a setting by key
router.delete('/:key', async (req, res) => {
  const { key } = req.params
  await db.delete(officeSettings).where(eq(officeSettings.key, key))
  res.json({ success: true })
})

export default router
