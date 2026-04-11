export type { RoomZone } from './stitcher'

import { RoomZone } from './stitcher'

export function isInZone(x: number, y: number, zone: RoomZone): boolean {
  return (
    x >= zone.bounds.x &&
    x < zone.bounds.x + zone.bounds.w &&
    y >= zone.bounds.y &&
    y < zone.bounds.y + zone.bounds.h
  )
}

export function findPlayerZone(x: number, y: number, zones: RoomZone[]): RoomZone | null {
  return zones.find((z) => isInZone(x, y, z)) || null
}
