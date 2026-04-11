import { Router } from 'express'
import { db } from '../db/connection'
import { officeLayout, roomPlacements, roomTemplates } from '../db/schema'
import { eq } from 'drizzle-orm'
import { stitchMap, MapPlacement } from '../map/stitcher'
import { authMiddleware } from '../auth/middleware'

const router = Router()

// GET /api/map — returns the stitched tilemap + zones + item placements
// This is what the client fetches to load the map
router.get('/', authMiddleware, async (req, res) => {
  // 1. Get the first (only) layout
  const layouts = await db.select().from(officeLayout).limit(1)
  if (layouts.length === 0) {
    // No layout exists yet — return a minimal empty map
    return res.json({
      tilemap: { width: 50, height: 50, tilewidth: 32, tileheight: 32, layers: [], tilesets: [] },
      zones: [],
      itemPlacements: [],
      spawnPoint: { x: 320, y: 160 },
    })
  }

  const layout = layouts[0]

  // 2. Get all placements for this layout with their templates
  const placementsWithTemplates = await db
    .select({
      id: roomPlacements.id,
      templateId: roomPlacements.templateId,
      gridX: roomPlacements.gridX,
      gridY: roomPlacements.gridY,
      roomName: roomPlacements.roomName,
      templateName: roomTemplates.name,
      widthBlocks: roomTemplates.widthBlocks,
      heightBlocks: roomTemplates.heightBlocks,
      tileData: roomTemplates.tileData,
      features: roomTemplates.features,
    })
    .from(roomPlacements)
    .innerJoin(roomTemplates, eq(roomPlacements.templateId, roomTemplates.id))
    .where(eq(roomPlacements.layoutId, layout.id))

  // 3. Transform to MapPlacement format
  const mapPlacements: MapPlacement[] = placementsWithTemplates.map(p => ({
    id: p.id,
    templateId: p.templateId,
    gridX: p.gridX,
    gridY: p.gridY,
    roomName: p.roomName,
    template: {
      name: p.templateName,
      widthBlocks: p.widthBlocks,
      heightBlocks: p.heightBlocks,
      tileData: p.tileData,
      features: p.features as any,
      itemSlots: ((p.features as any)?.itemSlots) || [],
    },
  }))

  // 4. Stitch and return
  const result = stitchMap(mapPlacements, layout.gridWidth, layout.gridHeight)
  res.json(result)
})

// GET /api/map/templates — list available room templates
router.get('/templates', authMiddleware, async (req, res) => {
  const templates = await db.select({
    id: roomTemplates.id,
    name: roomTemplates.name,
    category: roomTemplates.category,
    widthBlocks: roomTemplates.widthBlocks,
    heightBlocks: roomTemplates.heightBlocks,
    features: roomTemplates.features,
    isBuiltIn: roomTemplates.isBuiltIn,
  }).from(roomTemplates)

  res.json(templates)
})

export default router
