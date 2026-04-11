import { phaserEvents, Event } from '../events/EventCenter'
import { voiceService } from './VoiceService'
import store from '../stores'
import { setCurrentRoom, clearRoomChat } from '../stores/ChatStore'

interface ZoneInfo {
  roomId: string
  roomName: string
  bounds: { x: number; y: number; w: number; h: number }
}

interface RoomInfo {
  roomId: string
  roomName: string
}

type RoomChangeCallback = (room: RoomInfo | null) => void

class RoomService {
  private currentRoomInfo: RoomInfo | null = null
  private sessionId: string = ''
  private initialized = false
  private onRoomChangeCallbacks: RoomChangeCallback[] = []

  get currentRoom(): RoomInfo | null {
    return this.currentRoomInfo
  }

  init(sessionId: string) {
    this.sessionId = sessionId

    if (this.initialized) return
    this.initialized = true

    phaserEvents.on(Event.ENTER_ZONE, this.handleEnterZone, this)
    phaserEvents.on(Event.LEAVE_ZONE, this.handleLeaveZone, this)
  }

  private handleEnterZone(zone: ZoneInfo | null) {
    if (!zone) {
      this.handleLeaveZone()
      return
    }

    const { roomId, roomName } = zone

    voiceService.joinRoom(roomId, this.sessionId)

    this.currentRoomInfo = { roomId, roomName }
    store.dispatch(setCurrentRoom({ roomId, roomName }))
    this.notifyRoomChange(this.currentRoomInfo)
  }

  private handleLeaveZone() {
    voiceService.leaveRoom()

    this.currentRoomInfo = null
    store.dispatch(clearRoomChat())
    this.notifyRoomChange(null)
  }

  onRoomChange(callback: RoomChangeCallback) {
    this.onRoomChangeCallbacks.push(callback)
  }

  offRoomChange(callback: RoomChangeCallback) {
    this.onRoomChangeCallbacks = this.onRoomChangeCallbacks.filter((cb) => cb !== callback)
  }

  private notifyRoomChange(room: RoomInfo | null) {
    this.onRoomChangeCallbacks.forEach((cb) => cb(room))
  }
}

export const roomService = new RoomService()
export default roomService
