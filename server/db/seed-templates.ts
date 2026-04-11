import { db } from './connection'
import { roomTemplates } from './schema'
import { count } from 'drizzle-orm'
import type { RoomTemplateConfig } from '../map/templates'

// Grid cell = 10x10 tiles = 320x320px at 32px/tile
// Tile ID 415 is a common floor tile from the existing monolithic map
const FLOOR_TILE = 415

function makeTileData(w: number, h: number): object {
  const groundData = Array(w * h).fill(FLOOR_TILE)
  return {
    width: w,
    height: h,
    tilewidth: 32,
    tileheight: 32,
    layers: [
      {
        name: 'Ground',
        type: 'tilelayer',
        data: groundData,
        width: w,
        height: h,
      },
      { name: 'Wall', type: 'objectgroup', objects: [] },
      { name: 'Chair', type: 'objectgroup', objects: [] },
      { name: 'Computer', type: 'objectgroup', objects: [] },
      { name: 'Whiteboard', type: 'objectgroup', objects: [] },
    ],
    tilesets: [],
  }
}

// Pixel helpers: tile coords -> pixel center
function px(tileX: number): number {
  return tileX * 32 + 16
}
function py(tileY: number): number {
  return tileY * 32 + 16
}

const BUILT_IN_TEMPLATES: RoomTemplateConfig[] = [
  // -----------------------------------------------------------------------
  // Lobby  15×10 tiles, 2×1 blocks
  // -----------------------------------------------------------------------
  {
    name: 'Lobby',
    slug: 'lobby',
    category: 'common',
    widthBlocks: 2,
    heightBlocks: 1,
    tileData: makeTileData(20, 10),
    itemSlots: [
      { type: 'chair', x: px(2), y: py(2), direction: 'down' },
      { type: 'chair', x: px(12), y: py(2), direction: 'down' },
      { type: 'vendingmachine', x: px(7), y: py(1) },
    ],
    npcSpawnPoints: [{ x: px(7), y: py(5), label: 'Receptionist' }],
    features: { voice: false, screenshare: false, whiteboard: false, privateChat: false },
    isBuiltIn: true,
    spawnPoint: { x: 320, y: 160 },
  },

  // -----------------------------------------------------------------------
  // Meeting Room S  10×10 tiles, 1×1 block
  // -----------------------------------------------------------------------
  {
    name: 'Meeting Room S',
    slug: 'meeting-room-s',
    category: 'meeting',
    widthBlocks: 1,
    heightBlocks: 1,
    tileData: makeTileData(10, 10),
    itemSlots: [
      { type: 'whiteboard', x: px(5), y: py(1) },
      { type: 'chair', x: px(3), y: py(4), direction: 'up' },
      { type: 'chair', x: px(5), y: py(4), direction: 'up' },
      { type: 'chair', x: px(7), y: py(4), direction: 'up' },
      { type: 'chair', x: px(5), y: py(7), direction: 'down' },
    ],
    npcSpawnPoints: [],
    features: { voice: true, screenshare: true, whiteboard: true, privateChat: true },
    isBuiltIn: true,
  },

  // -----------------------------------------------------------------------
  // Meeting Room M  10×15 tiles, 1×2 blocks
  // -----------------------------------------------------------------------
  {
    name: 'Meeting Room M',
    slug: 'meeting-room-m',
    category: 'meeting',
    widthBlocks: 1,
    heightBlocks: 2,
    tileData: makeTileData(10, 20),
    itemSlots: [
      { type: 'whiteboard', x: px(5), y: py(1) },
      { type: 'chair', x: px(2), y: py(5), direction: 'right' },
      { type: 'chair', x: px(2), y: py(8), direction: 'right' },
      { type: 'chair', x: px(8), y: py(5), direction: 'left' },
      { type: 'chair', x: px(8), y: py(8), direction: 'left' },
      { type: 'chair', x: px(5), y: py(12), direction: 'up' },
    ],
    npcSpawnPoints: [],
    features: { voice: true, screenshare: true, whiteboard: true, privateChat: true },
    isBuiltIn: true,
  },

  // -----------------------------------------------------------------------
  // Meeting Room L  15×20 tiles, 2×2 blocks
  // -----------------------------------------------------------------------
  {
    name: 'Meeting Room L',
    slug: 'meeting-room-l',
    category: 'meeting',
    widthBlocks: 2,
    heightBlocks: 2,
    tileData: makeTileData(20, 20),
    itemSlots: [
      { type: 'whiteboard', x: px(4), y: py(1) },
      { type: 'whiteboard', x: px(10), y: py(1) },
      { type: 'chair', x: px(2),  y: py(6),  direction: 'right' },
      { type: 'chair', x: px(2),  y: py(10), direction: 'right' },
      { type: 'chair', x: px(2),  y: py(14), direction: 'right' },
      { type: 'chair', x: px(12), y: py(6),  direction: 'left' },
      { type: 'chair', x: px(12), y: py(10), direction: 'left' },
      { type: 'chair', x: px(12), y: py(14), direction: 'left' },
    ],
    npcSpawnPoints: [],
    features: { voice: true, screenshare: true, whiteboard: true, privateChat: true },
    isBuiltIn: true,
  },

  // -----------------------------------------------------------------------
  // Open Desk Area  20×20 tiles, 2×2 blocks
  // -----------------------------------------------------------------------
  {
    name: 'Open Desk Area',
    slug: 'open-desk-area',
    category: 'workspace',
    widthBlocks: 2,
    heightBlocks: 2,
    tileData: makeTileData(20, 20),
    itemSlots: [
      // Row 1 desks (computers + chairs)
      { type: 'computer', x: px(3),  y: py(4) },
      { type: 'chair',    x: px(3),  y: py(6),  direction: 'up' },
      { type: 'computer', x: px(8),  y: py(4) },
      { type: 'chair',    x: px(8),  y: py(6),  direction: 'up' },
      { type: 'computer', x: px(13), y: py(4) },
      { type: 'chair',    x: px(13), y: py(6),  direction: 'up' },
      { type: 'computer', x: px(17), y: py(4) },
      { type: 'chair',    x: px(17), y: py(6),  direction: 'up' },
      // Row 2 desks
      { type: 'computer', x: px(3),  y: py(12) },
      { type: 'chair',    x: px(3),  y: py(14), direction: 'up' },
      { type: 'computer', x: px(8),  y: py(12) },
      { type: 'chair',    x: px(8),  y: py(14), direction: 'up' },
      { type: 'computer', x: px(13), y: py(12) },
      { type: 'chair',    x: px(13), y: py(14), direction: 'up' },
      { type: 'computer', x: px(17), y: py(12) },
      { type: 'chair',    x: px(17), y: py(14), direction: 'up' },
    ],
    npcSpawnPoints: [],
    features: { voice: false, screenshare: false, whiteboard: false, privateChat: false },
    isBuiltIn: true,
  },

  // -----------------------------------------------------------------------
  // Break Room  10×10 tiles, 1×1 block
  // -----------------------------------------------------------------------
  {
    name: 'Break Room',
    slug: 'break-room',
    category: 'social',
    widthBlocks: 1,
    heightBlocks: 1,
    tileData: makeTileData(10, 10),
    itemSlots: [
      { type: 'vendingmachine', x: px(1), y: py(2) },
      { type: 'vendingmachine', x: px(1), y: py(5) },
      { type: 'chair', x: px(5), y: py(5), direction: 'down' },
      { type: 'chair', x: px(7), y: py(5), direction: 'down' },
      { type: 'chair', x: px(5), y: py(7), direction: 'up' },
      { type: 'chair', x: px(7), y: py(7), direction: 'up' },
    ],
    npcSpawnPoints: [],
    features: { voice: true, screenshare: false, whiteboard: false, privateChat: false },
    isBuiltIn: true,
  },

  // -----------------------------------------------------------------------
  // NPC Office  10×10 tiles, 1×1 block
  // -----------------------------------------------------------------------
  {
    name: 'NPC Office',
    slug: 'npc-office',
    category: 'npc',
    widthBlocks: 1,
    heightBlocks: 1,
    tileData: makeTileData(10, 10),
    itemSlots: [
      { type: 'computer', x: px(5), y: py(3) },
      { type: 'chair',    x: px(5), y: py(5), direction: 'up' },
      { type: 'chair',    x: px(5), y: py(7), direction: 'up' },
    ],
    npcSpawnPoints: [{ x: px(5), y: py(4), label: 'NPC' }],
    features: { voice: false, screenshare: false, whiteboard: false, privateChat: true },
    isBuiltIn: true,
  },

  // -----------------------------------------------------------------------
  // Hallway H  5×10 tiles, 1×1 block (horizontal corridor)
  // -----------------------------------------------------------------------
  {
    name: 'Hallway H',
    slug: 'hallway-h',
    category: 'connector',
    widthBlocks: 1,
    heightBlocks: 1,
    tileData: makeTileData(10, 10),
    itemSlots: [],
    npcSpawnPoints: [],
    features: { voice: false, screenshare: false, whiteboard: false, privateChat: false },
    isBuiltIn: true,
  },

  // -----------------------------------------------------------------------
  // Hallway V  10×5 tiles, 1×1 block (vertical corridor)
  // -----------------------------------------------------------------------
  {
    name: 'Hallway V',
    slug: 'hallway-v',
    category: 'connector',
    widthBlocks: 1,
    heightBlocks: 1,
    tileData: makeTileData(10, 10),
    itemSlots: [],
    npcSpawnPoints: [],
    features: { voice: false, screenshare: false, whiteboard: false, privateChat: false },
    isBuiltIn: true,
  },
]

export async function seedTemplates(): Promise<void> {
  const result = await db.select({ value: count() }).from(roomTemplates)
  if (result[0].value > 0) {
    console.log('Room templates exist, skipping seed.')
    return
  }

  const rows = BUILT_IN_TEMPLATES.map((t) => ({
    name: t.name,
    category: t.category,
    widthBlocks: t.widthBlocks,
    heightBlocks: t.heightBlocks,
    tileData: t.tileData,
    isBuiltIn: t.isBuiltIn,
    features: {
      ...t.features,
      ...(t.spawnPoint ? { spawnPoint: t.spawnPoint } : {}),
      itemSlots: t.itemSlots,
      npcSpawnPoints: t.npcSpawnPoints,
      slug: t.slug,
    },
  }))

  await db.insert(roomTemplates).values(rows)
  console.log(`Seeded ${rows.length} built-in room templates:`)
  rows.forEach((r) => console.log(`  - ${r.name} (${r.category})`))
}
