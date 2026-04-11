import React from 'react'
import styled from 'styled-components'
import { useAppDispatch, useAppSelector } from '../../hooks'
import { openDmWithPlayer } from '../../stores/ChatStore'
import { getColorByString } from '../../util'

const Container = styled.div`
  flex: 1;
  overflow-y: auto;
  background: #2c2c2c;
  border: 1px solid #00000029;
`

const SectionLabel = styled.div`
  padding: 6px 10px;
  font-size: 11px;
  text-transform: uppercase;
  color: #666;
  background: #1a1a1a;
  letter-spacing: 0.5px;
`

const PlayerRow = styled.div`
  display: flex;
  align-items: center;
  padding: 7px 10px;
  cursor: pointer;
  gap: 8px;

  &:hover {
    background: #3a3a3a;
  }
`

const PlayerName = styled.span<{ color: string }>`
  font-size: 14px;
  font-weight: bold;
  color: ${({ color }) => color};
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const UnreadBadge = styled.span`
  background: #e53935;
  color: #fff;
  border-radius: 10px;
  padding: 1px 7px;
  font-size: 11px;
  font-weight: bold;
  min-width: 18px;
  text-align: center;
`

const RecentMessage = styled.span`
  font-size: 12px;
  color: #888;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 140px;
`

const EmptyNote = styled.div`
  padding: 16px;
  color: #555;
  font-size: 13px;
  text-align: center;
`

export default function DMList() {
  const dispatch = useAppDispatch()
  const dmChannels = useAppSelector((state) => state.chat.dmChannels)
  const playerNameMap = useAppSelector((state) => state.user.playerNameMap)
  const sessionId = useAppSelector((state) => state.user.sessionId)

  const existingChannels = Object.values(dmChannels)

  // Players online but not yet in a DM channel
  const onlinePlayers: { id: string; name: string }[] = []
  playerNameMap.forEach((name, id) => {
    if (id !== sessionId && !dmChannels[id]) {
      onlinePlayers.push({ id, name })
    }
  })

  return (
    <Container>
      {existingChannels.length > 0 && (
        <>
          <SectionLabel>Recent</SectionLabel>
          {existingChannels.map((ch) => {
            const lastMsg = ch.messages[ch.messages.length - 1]
            return (
              <PlayerRow
                key={ch.partnerId}
                onClick={() =>
                  dispatch(openDmWithPlayer({ partnerId: ch.partnerId, partnerName: ch.partnerName }))
                }
              >
                <PlayerName color={getColorByString(ch.partnerName)}>{ch.partnerName}</PlayerName>
                {lastMsg && (
                  <RecentMessage>{lastMsg.chatMessage.content}</RecentMessage>
                )}
                {ch.unread > 0 && <UnreadBadge>{ch.unread}</UnreadBadge>}
              </PlayerRow>
            )
          })}
        </>
      )}
      {onlinePlayers.length > 0 && (
        <>
          <SectionLabel>Online</SectionLabel>
          {onlinePlayers.map(({ id, name }) => (
            <PlayerRow
              key={id}
              onClick={() => dispatch(openDmWithPlayer({ partnerId: id, partnerName: name }))}
            >
              <PlayerName color={getColorByString(name)}>{name}</PlayerName>
            </PlayerRow>
          ))}
        </>
      )}
      {existingChannels.length === 0 && onlinePlayers.length === 0 && (
        <EmptyNote>No other players online</EmptyNote>
      )}
    </Container>
  )
}
