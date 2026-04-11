import React, { useState, useEffect, useCallback } from 'react'
import styled from 'styled-components'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import VideocamIcon from '@mui/icons-material/Videocam'
import VideocamOffIcon from '@mui/icons-material/VideocamOff'
import ScreenShareIcon from '@mui/icons-material/ScreenShare'
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare'
import DashboardIcon from '@mui/icons-material/Dashboard'
import { phaserEvents, Event } from '../../events/EventCenter'
import { voiceService } from '../../services/VoiceService'
import { useAppSelector, useAppDispatch } from '../../hooks'
import { openComputerDialog } from '../../stores/ComputerStore'
import { openWhiteboardDialog } from '../../stores/WhiteboardStore'

const Panel = styled.div`
  position: fixed;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(34, 38, 57, 0.9);
  color: #ffffff;
  padding: 16px;
  border-radius: 12px 0 0 12px;
  width: 200px;
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 12px;
`

const RoomHeader = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: #a8b2d8;
  text-align: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 10px;
  word-break: break-word;
`

const Controls = styled.div`
  display: flex;
  justify-content: space-around;
  gap: 4px;
`

const IconButton = styled.button<{ active?: boolean }>`
  background: ${({ active }) => (active ? 'rgba(100, 181, 246, 0.2)' : 'rgba(255, 255, 255, 0.08)')};
  border: 1px solid ${({ active }) => (active ? 'rgba(100, 181, 246, 0.5)' : 'rgba(255, 255, 255, 0.15)')};
  color: ${({ active }) => (active ? '#64b5f6' : '#ffffff')};
  border-radius: 8px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.16);
  }

  svg {
    font-size: 18px;
  }
`

const MemberSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`

const MemberCount = styled.div`
  font-size: 12px;
  color: #a8b2d8;
`

const MemberList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 120px;
  overflow-y: auto;
`

const MemberItem = styled.div`
  font-size: 12px;
  color: #e2e8f0;
  background: rgba(255, 255, 255, 0.06);
  padding: 4px 8px;
  border-radius: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

interface ZoneInfo {
  roomId: string
  roomName: string
}

export default function MeetingPanel() {
  const dispatch = useAppDispatch()
  const sessionId = useAppSelector((state) => state.user.sessionId)
  const [zone, setZone] = useState<ZoneInfo | null>(null)
  const [micOn, setMicOn] = useState(false)
  const [cameraOn, setCameraOn] = useState(false)
  const [members, setMembers] = useState<string[]>([])

  const syncVoiceState = useCallback(() => {
    setMicOn(voiceService.isMicOn)
    setCameraOn(voiceService.isCameraOn)
    setMembers(Array.from(voiceService.memberList.keys()))
  }, [])

  useEffect(() => {
    const handleEnterZone = (z: ZoneInfo | null) => {
      if (z) {
        setZone(z)
        syncVoiceState()
      } else {
        setZone(null)
      }
    }

    const handleLeaveZone = () => {
      setZone(null)
    }

    phaserEvents.on(Event.ENTER_ZONE, handleEnterZone)
    phaserEvents.on(Event.LEAVE_ZONE, handleLeaveZone)
    voiceService.onStateChange(syncVoiceState)

    return () => {
      phaserEvents.off(Event.ENTER_ZONE, handleEnterZone)
      phaserEvents.off(Event.LEAVE_ZONE, handleLeaveZone)
      voiceService.offStateChange(syncVoiceState)
    }
  }, [syncVoiceState])

  if (!zone) return null

  const handleMicToggle = () => {
    voiceService.toggleMic()
  }

  const handleCameraToggle = () => {
    voiceService.toggleCamera()
  }

  const handleScreenShare = () => {
    if (sessionId) {
      dispatch(openComputerDialog({ computerId: '0', myUserId: sessionId }))
    }
  }

  const handleWhiteboard = () => {
    dispatch(openWhiteboardDialog('0'))
  }

  const allMembers = sessionId
    ? ['You', ...members.map((id) => id)]
    : members.map((id) => id)

  return (
    <Panel>
      <RoomHeader>{zone.roomName}</RoomHeader>
      <Controls>
        <IconButton active={micOn} onClick={handleMicToggle} title={micOn ? 'Mute mic' : 'Unmute mic'}>
          {micOn ? <MicIcon /> : <MicOffIcon />}
        </IconButton>
        <IconButton active={cameraOn} onClick={handleCameraToggle} title={cameraOn ? 'Turn off camera' : 'Turn on camera'}>
          {cameraOn ? <VideocamIcon /> : <VideocamOffIcon />}
        </IconButton>
        <IconButton onClick={handleScreenShare} title="Share screen">
          <ScreenShareIcon />
        </IconButton>
        <IconButton onClick={handleWhiteboard} title="Whiteboard">
          <DashboardIcon />
        </IconButton>
      </Controls>
      <MemberSection>
        <MemberCount>{allMembers.length} member{allMembers.length !== 1 ? 's' : ''}</MemberCount>
        <MemberList>
          {allMembers.map((label, i) => (
            <MemberItem key={i}>{label}</MemberItem>
          ))}
        </MemberList>
      </MemberSection>
    </Panel>
  )
}
