import { Router } from 'express'
import { db } from '../db/connection'
import { officeLayout, roomPlacements, roomTemplates } from '../db/schema'
import { eq } from 'drizzle-orm'
import { authMiddleware, adminOnly } from '../auth/middleware'

const router = Router()

// All admin routes require auth + admin
router.use(authMiddleware, adminOnly)

// GET /api/admin/layout — get current layout with placements
router.get('/layout', async (req, res) => {
  const layouts = await db.select().from(officeLayout).limit(1)
  if (layouts.length === 0) {
    return res.json(null)
  }

  const layout = layouts[0]
  const placements = await db
    .select()
    .from(roomPlacements)
    .where(eq(roomPlacements.layoutId, layout.id))

  res.json({ ...layout, placements })
})

// PUT /api/admin/layout — save office layout (create or update)
// Body: { gridWidth, gridHeight, placements: [{ templateId, gridX, gridY, roomName }] }
router.put('/layout', async (req, res) => {
  const { gridWidth, gridHeight, placements } = req.body

  // Validate
  if (!gridWidth || !gridHeight || !Array.isArray(placements)) {
    return res.status(400).json({ error: 'gridWidth, gridHeight, and placements[] required' })
  }

  // Validate all templateIds exist
  const templateIds = [...new Set(placements.map((p: any) => p.templateId))]
  const templates = await db.select({ id: roomTemplates.id }).from(roomTemplates)
  const validIds = new Set(templates.map(t => t.id))
  for (const tid of templateIds) {
    if (!validIds.has(tid)) {
      return res.status(400).json({ error: `Template ${tid} not found` })
    }
  }

  // Check for overlaps (simplified — just check no two placements share the same grid cell)
  // TODO: account for multi-block templates in overlap detection
  const occupied = new Set<string>()
  for (const p of placements) {
    const key = `${p.gridX},${p.gridY}`
    if (occupied.has(key)) {
      return res.status(400).json({ error: `Overlap at grid position (${p.gridX}, ${p.gridY})` })
    }
    occupied.add(key)
  }

  // Upsert layout
  let layoutId: string
  const existing = await db.select().from(officeLayout).limit(1)
  if (existing.length > 0) {
    layoutId = existing[0].id
    await db.update(officeLayout)
      .set({ gridWidth, gridHeight, updatedAt: new Date() })
      .where(eq(officeLayout.id, layoutId))
    // Delete old placements
    await db.delete(roomPlacements).where(eq(roomPlacements.layoutId, layoutId))
  } else {
    const result = await db.insert(officeLayout)
      .values({ gridWidth, gridHeight })
      .returning({ id: officeLayout.id })
    layoutId = result[0].id
  }

  // Insert new placements
  if (placements.length > 0) {
    await db.insert(roomPlacements).values(
      placements.map((p: any) => ({
        layoutId,
        templateId: p.templateId,
        gridX: p.gridX,
        gridY: p.gridY,
        roomName: p.roomName || null,
      }))
    )
  }

  res.json({ layoutId, placementCount: placements.length })
})

export default router
