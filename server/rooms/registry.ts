import { Room } from 'colyseus'
import { IOfficeState } from '../../types/IOfficeState'

/** Global registry of active SkyOffice rooms — used by HP reset cron */
export const activeRooms: Room<IOfficeState>[] = []

export function registerRoom(room: Room<IOfficeState>) {
  activeRooms.push(room)
}

export function unregisterRoom(room: Room<IOfficeState>) {
  const idx = activeRooms.indexOf(room)
  if (idx >= 0) activeRooms.splice(idx, 1)
}
