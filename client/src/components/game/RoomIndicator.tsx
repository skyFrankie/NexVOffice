import React, { useState, useEffect } from 'react'
import styled from 'styled-components'
import { phaserEvents, Event } from '../../events/EventCenter'

const Wrapper = styled.div`
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.6);
  color: white;
  padding: 6px 16px;
  border-radius: 8px;
  font-size: 14px;
  pointer-events: none;
  z-index: 10;
  transition: opacity 0.3s ease;
`

export default function RoomIndicator() {
  const [roomName, setRoomName] = useState<string | null>(null)

  useEffect(() => {
    const handler = (zone: any) => {
      setRoomName(zone?.roomName || null)
    }
    phaserEvents.on(Event.ENTER_ZONE, handler)
    return () => {
      phaserEvents.off(Event.ENTER_ZONE, handler)
    }
  }, [])

  if (!roomName) return null
  return <Wrapper>{roomName}</Wrapper>
}
