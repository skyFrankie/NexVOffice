import React, { useState, useEffect } from 'react'
import styled from 'styled-components'
import { phaserEvents, Event } from '../../events/EventCenter'
import { useAppSelector } from '../../hooks'

const HUDContainer = styled.div`
  position: fixed;
  bottom: 20px;
  left: 20px;
  background: rgba(34, 38, 57, 0.85);
  padding: 10px 14px;
  border-radius: 10px;
  z-index: 100;
  min-width: 140px;
`

const HPLabel = styled.div`
  font-size: 12px;
  color: #a8b2d8;
  margin-bottom: 4px;
  font-family: Arial, sans-serif;
`

const BarTrack = styled.div`
  width: 120px;
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
`

const BarFill = styled.div<{ percent: number; color: string }>`
  width: ${({ percent }) => percent}%;
  height: 100%;
  background: ${({ color }) => color};
  border-radius: 4px;
  transition: width 0.3s ease, background 0.3s ease;
`

function getBarColor(percent: number): string {
  if (percent > 60) return '#22c55e'
  if (percent > 30) return '#eab308'
  return '#ef4444'
}

interface PlayerHUDProps {
  initialHp?: number
  initialMaxHp?: number
}

export default function PlayerHUD({ initialHp = 100, initialMaxHp = 100 }: PlayerHUDProps) {
  const [hp, setHp] = useState(initialHp)
  const [maxHp, setMaxHp] = useState(initialMaxHp)
  const sessionId = useAppSelector((state) => state.user.sessionId)

  useEffect(() => {
    const handleHpUpdate = (data: { userId: string; hp: number; maxHp: number }) => {
      if (data.userId === sessionId) {
        setHp(data.hp)
        setMaxHp(data.maxHp)
      }
    }

    phaserEvents.on(Event.HP_UPDATE, handleHpUpdate)
    return () => {
      phaserEvents.off(Event.HP_UPDATE, handleHpUpdate)
    }
  }, [sessionId])

  const percent = maxHp > 0 ? Math.round((hp / maxHp) * 100) : 0
  const color = getBarColor(percent)

  return (
    <HUDContainer>
      <HPLabel>
        HP: {hp}/{maxHp}
      </HPLabel>
      <BarTrack>
        <BarFill percent={percent} color={color} />
      </BarTrack>
    </HUDContainer>
  )
}
