import React, { useEffect, useRef } from 'react'
import styled from 'styled-components'

import { useAppSelector } from './hooks'
import { useAuth } from './hooks/useAuth'

import LoginPage from './components/auth/LoginPage'
import LoginDialog from './components/LoginDialog'
import ComputerDialog from './components/ComputerDialog'
import WhiteboardDialog from './components/WhiteboardDialog'
import VideoConnectionDialog from './components/VideoConnectionDialog'
import ChatPanel from './components/chat'
import HelperButtonGroup from './components/HelperButtonGroup'
import MobileVirtualJoystick from './components/MobileVirtualJoystick'
import RoomIndicator from './components/game/RoomIndicator'
import MeetingPanel from './components/game/MeetingPanel'

import phaserGame from './PhaserGame'
import Bootstrap from './scenes/Bootstrap'
import networkService from './services/NetworkService'

const Backdrop = styled.div`
  position: absolute;
  height: 100%;
  width: 100%;
`

function App() {
  const { isAuthenticated } = useAuth()
  const loggedIn = useAppSelector((state) => state.user.loggedIn)
  const computerDialogOpen = useAppSelector((state) => state.computer.computerDialogOpen)
  const whiteboardDialogOpen = useAppSelector((state) => state.whiteboard.whiteboardDialogOpen)
  const videoConnected = useAppSelector((state) => state.user.videoConnected)
  const roomJoined = useAppSelector((state) => state.room.roomJoined)
  const lobbyJoined = useAppSelector((state) => state.room.lobbyJoined)

  // Track whether we've already triggered the auto-join to avoid double-joining
  const autoJoinTriggered = useRef(false)

  // Once authenticated and lobby is ready, auto-join the public room
  useEffect(() => {
    if (isAuthenticated && lobbyJoined && !roomJoined && !autoJoinTriggered.current) {
      autoJoinTriggered.current = true
      const bootstrap = phaserGame.scene.keys.bootstrap as Bootstrap
      networkService
        .getNetwork()
        .joinOrCreatePublic()
        .then(() => bootstrap.launchGame())
        .catch((error) => {
          console.error('Auto-join failed:', error)
          autoJoinTriggered.current = false
        })
    }
  }, [isAuthenticated, lobbyJoined, roomJoined])

  // Reset auto-join flag if user logs out
  useEffect(() => {
    if (!isAuthenticated) {
      autoJoinTriggered.current = false
    }
  }, [isAuthenticated])

  // Not authenticated — show login page (Phaser is running in background but hidden behind LoginPage)
  if (!isAuthenticated) {
    return <LoginPage />
  }

  let ui: JSX.Element
  if (loggedIn) {
    if (computerDialogOpen) {
      /* Render ComputerDialog if user is using a computer. */
      ui = <ComputerDialog />
    } else if (whiteboardDialogOpen) {
      /* Render WhiteboardDialog if user is using a whiteboard. */
      ui = <WhiteboardDialog />
    } else {
      ui = (
        /* Render Chat or VideoConnectionDialog if no dialogs are opened. */
        <>
          <ChatPanel />
          {/* Render VideoConnectionDialog if user is not connected to a webcam. */}
          {!videoConnected && <VideoConnectionDialog />}
          <MobileVirtualJoystick />
        </>
      )
    }
  } else if (roomJoined) {
    /* Render LoginDialog (avatar/name selection) once the room is joined. */
    ui = <LoginDialog />
  } else {
    /* Room not yet joined — show nothing while auto-join is in progress. */
    ui = <></>
  }

  return (
    <Backdrop>
      {ui}
      {/* Render HelperButtonGroup if no dialogs are opened. */}
      {!computerDialogOpen && !whiteboardDialogOpen && <HelperButtonGroup />}
      {/* Render RoomIndicator when in-game to show current zone name. */}
      {loggedIn && <RoomIndicator />}
      {loggedIn && <MeetingPanel />}
    </Backdrop>
  )
}

export default App
