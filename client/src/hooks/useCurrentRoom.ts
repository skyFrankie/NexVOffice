import { useState, useEffect } from 'react'
import { roomService } from '../services/RoomService'

interface CurrentRoom {
  roomId: string | null
  roomName: string | null
  isInRoom: boolean
}

export function useCurrentRoom(): CurrentRoom {
  const [room, setRoom] = useState<{ roomId: string; roomName: string } | null>(
    roomService.currentRoom
  )

  useEffect(() => {
    const handleRoomChange = (newRoom: { roomId: string; roomName: string } | null) => {
      setRoom(newRoom)
    }

    roomService.onRoomChange(handleRoomChange)
    return () => {
      roomService.offRoomChange(handleRoomChange)
    }
  }, [])

  return {
    roomId: room?.roomId ?? null,
    roomName: room?.roomName ?? null,
    isInRoom: room !== null,
  }
}
