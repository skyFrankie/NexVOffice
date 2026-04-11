export interface ItemSlot {
  type: 'chair' | 'computer' | 'whiteboard' | 'vendingmachine'
  x: number // pixel x within the template
  y: number // pixel y within the template
  direction?: string // for chairs
}

export interface NpcSpawnPoint {
  x: number
  y: number
  label: string
}

export interface RoomFeatures {
  voice: boolean
  screenshare: boolean
  whiteboard: boolean
  privateChat: boolean
}

export interface RoomTemplateConfig {
  name: string
  slug: string
  category: string
  widthBlocks: number
  heightBlocks: number
  tileData: object // Tiled JSON subset for this room
  itemSlots: ItemSlot[]
  npcSpawnPoints: NpcSpawnPoint[]
  features: RoomFeatures
  isBuiltIn: boolean
  spawnPoint?: { x: number; y: number } // only Lobby has this
}
