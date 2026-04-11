import { RoomFeatures } from './templates'

export interface MapPlacement {
  id: string           // room_placements.id
  templateId: string
  gridX: number
  gridY: number
  roomName: string | null
  template: {
    name: string
    widthBlocks: number
    heightBlocks: number
    tileData: any       // Tiled JSON subset
    features: RoomFeatures
    itemSlots: any[]
  }
}

export interface StitchedMap {
  tilemap: object       // Full Tiled-compatible JSON
  zones: RoomZone[]
  itemPlacements: ItemPlacement[]
  spawnPoint: { x: number; y: number }
}

export interface ItemPlacement {
  id: string            // generated: `${placementId}-${slotIndex}`
  type: string          // 'computer' | 'whiteboard' | 'chair' | 'vendingmachine'
  x: number             // absolute pixel x
  y: number             // absolute pixel y
  direction?: string    // for chairs
  roomId: string        // which room placement this belongs to
}

export interface RoomZone {
  roomId: string
  roomName: string
  bounds: { x: number; y: number; w: number; h: number }
  features: RoomFeatures
}

const BLOCK_TILE_SIZE = 10  // tiles per grid block
const TILE_SIZE = 32        // pixels per tile
const WALL_TILE_ID = 92     // from existing map - vertical wall
const FLOOR_TILE_ID = 415   // common floor tile
const DOOR_TILE_ID = 0      // empty = doorway opening

function createEmptyObjectLayer(name: string, id: number): object {
  return {
    draworder: 'topdown',
    id,
    name,
    objects: [] as any[],
    opacity: 1,
    type: 'objectgroup',
    visible: true,
    x: 0,
    y: 0,
  }
}

function findLayer(layers: any[], name: string): any | null {
  if (!Array.isArray(layers)) return null
  return layers.find((l: any) => l.name === name) || null
}

export function stitchMap(
  placements: MapPlacement[],
  gridWidth: number,
  gridHeight: number
): StitchedMap {
  const canvasWidthTiles = gridWidth * BLOCK_TILE_SIZE
  const canvasHeightTiles = gridHeight * BLOCK_TILE_SIZE

  // Build a lookup of occupied grid cells: key = `${gx},${gy}`
  const occupiedCells = new Set<string>()
  for (const p of placements) {
    for (let dy = 0; dy < p.template.heightBlocks; dy++) {
      for (let dx = 0; dx < p.template.widthBlocks; dx++) {
        occupiedCells.add(`${p.gridX + dx},${p.gridY + dy}`)
      }
    }
  }

  // Initialize Ground layer data (0 = empty)
  const groundData: number[] = new Array(canvasWidthTiles * canvasHeightTiles).fill(0)

  // Initialize object layers
  const objectLayerNames = [
    'Wall', 'Chair', 'Computer', 'Whiteboard', 'VendingMachine',
    'Objects', 'ObjectsOnCollide', 'GenericObjects', 'GenericObjectsOnCollide', 'Basement',
  ]
  const objectLayers: Record<string, any[]> = {}
  for (const name of objectLayerNames) {
    objectLayers[name] = []
  }

  // Track object ID counter for Tiled (must be unique across all objects)
  let objectIdCounter = 1

  // Stamp each placement
  for (const placement of placements) {
    const { template, gridX, gridY } = placement
    const offsetXTiles = gridX * BLOCK_TILE_SIZE
    const offsetYTiles = gridY * BLOCK_TILE_SIZE
    const offsetXPixels = offsetXTiles * TILE_SIZE
    const offsetYPixels = offsetYTiles * TILE_SIZE

    const templateWidthTiles = template.widthBlocks * BLOCK_TILE_SIZE
    const templateHeightTiles = template.heightBlocks * BLOCK_TILE_SIZE

    // Copy Ground layer tile data row by row
    const tileDataLayers: any[] = Array.isArray(template.tileData?.layers)
      ? template.tileData.layers
      : []

    const groundLayer = findLayer(tileDataLayers, 'Ground')
    if (groundLayer && Array.isArray(groundLayer.data)) {
      for (let row = 0; row < templateHeightTiles; row++) {
        for (let col = 0; col < templateWidthTiles; col++) {
          const srcIdx = row * templateWidthTiles + col
          const dstRow = offsetYTiles + row
          const dstCol = offsetXTiles + col
          if (dstRow < canvasHeightTiles && dstCol < canvasWidthTiles) {
            const dstIdx = dstRow * canvasWidthTiles + dstCol
            const tileId = groundLayer.data[srcIdx]
            if (tileId !== undefined && tileId !== 0) {
              groundData[dstIdx] = tileId
            }
          }
        }
      }
    } else {
      // No ground layer data — fill area with floor tiles
      for (let row = 0; row < templateHeightTiles; row++) {
        for (let col = 0; col < templateWidthTiles; col++) {
          const dstRow = offsetYTiles + row
          const dstCol = offsetXTiles + col
          if (dstRow < canvasHeightTiles && dstCol < canvasWidthTiles) {
            groundData[dstRow * canvasWidthTiles + dstCol] = FLOOR_TILE_ID
          }
        }
      }
    }

    // Copy object layers, offsetting pixel positions
    for (const layerName of objectLayerNames) {
      const srcLayer = findLayer(tileDataLayers, layerName)
      if (srcLayer && Array.isArray(srcLayer.objects)) {
        for (const obj of srcLayer.objects) {
          objectLayers[layerName].push({
            ...obj,
            id: objectIdCounter++,
            x: (obj.x || 0) + offsetXPixels,
            y: (obj.y || 0) + offsetYPixels,
          })
        }
      }
    }

    // Generate wall borders: check each edge of the placement footprint
    // For each grid block on the border, check if the adjacent cell is empty
    for (let dy = 0; dy < template.heightBlocks; dy++) {
      for (let dx = 0; dx < template.widthBlocks; dx++) {
        const cellX = gridX + dx
        const cellY = gridY + dy

        // Cell top-left in tiles
        const cellTileX = (cellX) * BLOCK_TILE_SIZE
        const cellTileY = (cellY) * BLOCK_TILE_SIZE

        // Check four sides: top, bottom, left, right
        const sides = [
          { dir: 'top',    adjX: cellX,     adjY: cellY - 1, edgeRow: cellTileY,                    edgeCol: cellTileX, horizontal: true  },
          { dir: 'bottom', adjX: cellX,     adjY: cellY + 1, edgeRow: cellTileY + BLOCK_TILE_SIZE - 1, edgeCol: cellTileX, horizontal: true  },
          { dir: 'left',   adjX: cellX - 1, adjY: cellY,     edgeRow: cellTileY, edgeCol: cellTileX,                    horizontal: false },
          { dir: 'right',  adjX: cellX + 1, adjY: cellY,     edgeRow: cellTileY, edgeCol: cellTileX + BLOCK_TILE_SIZE - 1, horizontal: false },
        ]

        for (const side of sides) {
          const adjOccupied = occupiedCells.has(`${side.adjX},${side.adjY}`)
          if (adjOccupied) continue // shared wall with another room — handled by doorway logic below

          // No adjacent room: place solid wall along this edge
          const length = BLOCK_TILE_SIZE
          const midpoint = Math.floor(length / 2)

          for (let i = 0; i < length; i++) {
            let tileRow: number
            let tileCol: number

            if (side.horizontal) {
              tileRow = side.edgeRow
              tileCol = side.edgeCol + i
            } else {
              tileRow = side.edgeRow + i
              tileCol = side.edgeCol
            }

            if (tileRow >= 0 && tileRow < canvasHeightTiles && tileCol >= 0 && tileCol < canvasWidthTiles) {
              const idx = tileRow * canvasWidthTiles + tileCol
              groundData[idx] = WALL_TILE_ID
            }
          }
        }
      }
    }

    // Doorway openings: for each shared edge between adjacent occupied cells,
    // place DOOR_TILE_ID at the midpoint of the shared edge
    for (let dy = 0; dy < template.heightBlocks; dy++) {
      for (let dx = 0; dx < template.widthBlocks; dx++) {
        const cellX = gridX + dx
        const cellY = gridY + dy
        const cellTileX = cellX * BLOCK_TILE_SIZE
        const cellTileY = cellY * BLOCK_TILE_SIZE

        // Check right and bottom neighbors (to avoid double-processing)
        const neighbors = [
          { adjX: cellX + 1, adjY: cellY,     horizontal: false, edgeCol: cellTileX + BLOCK_TILE_SIZE - 1, edgeRow: cellTileY },
          { adjX: cellX,     adjY: cellY + 1, horizontal: true,  edgeRow: cellTileY + BLOCK_TILE_SIZE - 1, edgeCol: cellTileX },
        ]

        for (const nb of neighbors) {
          if (!occupiedCells.has(`${nb.adjX},${nb.adjY}`)) continue

          // Place a 1-tile doorway at midpoint of shared edge
          const mid = Math.floor(BLOCK_TILE_SIZE / 2)
          let doorRow: number
          let doorCol: number

          if (nb.horizontal) {
            doorRow = nb.edgeRow
            doorCol = nb.edgeCol + mid
          } else {
            doorRow = nb.edgeRow + mid
            doorCol = nb.edgeCol
          }

          if (doorRow >= 0 && doorRow < canvasHeightTiles && doorCol >= 0 && doorCol < canvasWidthTiles) {
            groundData[doorRow * canvasWidthTiles + doorCol] = DOOR_TILE_ID
          }
        }
      }
    }
  }

  // Build zones
  const zones: RoomZone[] = placements.map((p) => ({
    roomId: p.id,
    roomName: p.roomName || p.template.name,
    bounds: {
      x: p.gridX * BLOCK_TILE_SIZE * TILE_SIZE,
      y: p.gridY * BLOCK_TILE_SIZE * TILE_SIZE,
      w: p.template.widthBlocks * BLOCK_TILE_SIZE * TILE_SIZE,
      h: p.template.heightBlocks * BLOCK_TILE_SIZE * TILE_SIZE,
    },
    features: p.template.features,
  }))

  // Build item placements
  const itemPlacements: ItemPlacement[] = []
  for (const placement of placements) {
    const offsetXPixels = placement.gridX * BLOCK_TILE_SIZE * TILE_SIZE
    const offsetYPixels = placement.gridY * BLOCK_TILE_SIZE * TILE_SIZE

    if (Array.isArray(placement.template.itemSlots)) {
      placement.template.itemSlots.forEach((slot: any, slotIndex: number) => {
        itemPlacements.push({
          id: `${placement.id}-${slotIndex}`,
          type: slot.type,
          x: (slot.x || 0) + offsetXPixels,
          y: (slot.y || 0) + offsetYPixels,
          direction: slot.direction,
          roomId: placement.id,
        })
      })
    }
  }

  // Find spawn point — look for a Lobby template
  let spawnPoint = { x: 320, y: 160 }
  for (const placement of placements) {
    const featuresSpawn = (placement.template.features as any)?.spawnPoint
    if (
      placement.template.name.toLowerCase().includes('lobby') &&
      featuresSpawn
    ) {
      spawnPoint = {
        x: featuresSpawn.x + placement.gridX * BLOCK_TILE_SIZE * TILE_SIZE,
        y: featuresSpawn.y + placement.gridY * BLOCK_TILE_SIZE * TILE_SIZE,
      }
      break
    }
  }

  // Assemble output Tiled JSON
  const groundLayerOut = {
    data: groundData,
    height: canvasHeightTiles,
    id: 1,
    name: 'Ground',
    opacity: 1,
    type: 'tilelayer',
    visible: true,
    width: canvasWidthTiles,
    x: 0,
    y: 0,
  }

  const layerDefs: Array<{ name: string; id: number }> = [
    { name: 'Wall', id: 2 },
    { name: 'Chair', id: 3 },
    { name: 'Computer', id: 4 },
    { name: 'Whiteboard', id: 5 },
    { name: 'VendingMachine', id: 6 },
    { name: 'Objects', id: 7 },
    { name: 'ObjectsOnCollide', id: 8 },
    { name: 'GenericObjects', id: 9 },
    { name: 'GenericObjectsOnCollide', id: 10 },
    { name: 'Basement', id: 11 },
  ]

  const objectLayersOut = layerDefs.map(({ name, id }) => ({
    draworder: 'topdown',
    id,
    name,
    objects: objectLayers[name],
    opacity: 1,
    type: 'objectgroup',
    visible: true,
    x: 0,
    y: 0,
  }))

  const tilemap = {
    compressionlevel: -1,
    width: canvasWidthTiles,
    height: canvasHeightTiles,
    tilewidth: TILE_SIZE,
    tileheight: TILE_SIZE,
    infinite: false,
    orientation: 'orthogonal',
    renderorder: 'right-down',
    type: 'map',
    version: '1.6',
    tiledversion: '1.7.2',
    layers: [groundLayerOut, ...objectLayersOut],
    tilesets: [
      { firstgid: 1, source: 'FloorAndGround.json' },
    ],
  }

  return { tilemap, zones, itemPlacements, spawnPoint }
}
