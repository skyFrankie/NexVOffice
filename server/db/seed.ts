import { db } from './connection'
import { users, officeLayout, roomPlacements, roomTemplates } from './schema'
import { eq, count } from 'drizzle-orm'
import bcrypt from 'bcrypt'
import { config } from '../config'
import { seedTemplates } from './seed-templates'

export async function seedAdmin() {
  const result = await db.select({ value: count() }).from(users)
  if (result[0].value > 0) {
    console.log('Users exist, skipping seed.')
    return
  }

  const hash = await bcrypt.hash('changeme', config.bcryptRounds)
  await db.insert(users).values({
    username: 'admin',
    passwordHash: hash,
    displayName: 'Admin',
    avatar: 'adam',
    role: 'admin',
    mustChangePassword: true,
  })
  console.log('Admin account seeded (username: admin, password: changeme)')
}

export async function seedDefaultLayout() {
  // Check if a layout already exists
  const result = await db.select({ value: count() }).from(officeLayout)
  if (result[0].value > 0) {
    console.log('Office layout exists, skipping seed.')
    return
  }

  // Need templates to exist first
  await seedTemplates()

  // Get template IDs by name
  const templates = await db.select({ id: roomTemplates.id, name: roomTemplates.name }).from(roomTemplates)
  const templateMap = new Map(templates.map(t => [t.name, t.id]))

  // Create a 5x4 grid layout
  const layoutResult = await db.insert(officeLayout).values({
    gridWidth: 5,
    gridHeight: 4,
  }).returning({ id: officeLayout.id })
  const layoutId = layoutResult[0].id

  // Place rooms on the grid:
  // Row 0: Lobby (2x1 at 0,0), Meeting Room S (1x1 at 2,0)
  // Row 1: Hallway H (1x1 at 0,1), Open Desk Area (2x2 at 1,1), Break Room (1x1 at 3,1)
  // Row 2: (hallway continues), (desk continues), NPC Office (1x1 at 3,2)
  // Row 3: empty
  const placements = [
    { templateName: 'Lobby', gridX: 0, gridY: 0, roomName: 'Main Lobby' },
    { templateName: 'Meeting Room S', gridX: 2, gridY: 0, roomName: 'Meeting Room A' },
    { templateName: 'Hallway H', gridX: 0, gridY: 1, roomName: null },
    { templateName: 'Open Desk Area', gridX: 1, gridY: 1, roomName: 'Open Office' },
    { templateName: 'Break Room', gridX: 3, gridY: 1, roomName: 'Kitchen' },
    { templateName: 'NPC Office', gridX: 3, gridY: 2, roomName: 'HR Office' },
  ]

  const placementValues = placements
    .filter(p => templateMap.has(p.templateName))
    .map(p => ({
      layoutId,
      templateId: templateMap.get(p.templateName)!,
      gridX: p.gridX,
      gridY: p.gridY,
      roomName: p.roomName,
    }))

  if (placementValues.length > 0) {
    await db.insert(roomPlacements).values(placementValues)
  }

  console.log(`Default office layout seeded: ${placementValues.length} rooms on 5x4 grid`)
}
