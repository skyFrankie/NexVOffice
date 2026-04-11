import React from 'react'
import styled from 'styled-components'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import CloseIcon from '@mui/icons-material/Close'

import { useAppSelector, useAppDispatch } from '../hooks'
import { closeComputerDialog } from '../stores/ComputerStore'

import Video from './Video'

const Backdrop = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  padding: 16px 180px 16px 16px;
`

const Wrapper = styled.div`
  width: 100%;
  height: 100%;
  background: #222639;
  border-radius: 16px;
  padding: 16px;
  color: #eee;
  position: relative;
  display: flex;
  flex-direction: column;
  box-shadow: 0px 0px 5px #0000006f;

  .close {
    position: absolute;
    top: 0px;
    right: 0px;
  }
`

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  padding-right: 40px;
`

const Title = styled.h3`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #eee;
`

const LiveBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(220, 38, 38, 0.15);
  border: 1px solid rgba(220, 38, 38, 0.5);
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: #f87171;

  &::before {
    content: '';
    display: inline-block;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #ef4444;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
`

const SharingName = styled.span`
  font-size: 13px;
  color: #a0aec0;
`

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
`

const YouSharingBadge = styled.span`
  font-size: 12px;
  color: #68d391;
  background: rgba(72, 187, 120, 0.1);
  border: 1px solid rgba(72, 187, 120, 0.3);
  border-radius: 4px;
  padding: 2px 8px;
`

const MainPresenter = styled.div`
  flex: 1;
  min-height: 0;
  background: black;
  border-radius: 8px;
  overflow: hidden;
  position: relative;

  video {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .player-name {
    position: absolute;
    bottom: 16px;
    left: 16px;
    color: #fff;
    overflow: hidden;
    text-overflow: ellipsis;
    text-shadow: 0 1px 2px rgb(0 0 0 / 60%), 0 0 2px rgb(0 0 0 / 30%);
    white-space: nowrap;
  }
`

const ThumbnailStrip = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 8px;
  height: 90px;
  overflow-x: auto;
`

const Thumbnail = styled.div`
  flex: 0 0 120px;
  background: black;
  border-radius: 6px;
  overflow: hidden;
  position: relative;

  video {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .player-name {
    position: absolute;
    bottom: 6px;
    left: 6px;
    font-size: 10px;
    color: #fff;
    overflow: hidden;
    text-overflow: ellipsis;
    text-shadow: 0 1px 2px rgb(0 0 0 / 60%), 0 0 2px rgb(0 0 0 / 30%);
    white-space: nowrap;
  }
`

const EmptyState = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #4a5568;
  font-size: 14px;
`

function VideoContainer({ playerName, stream }: { playerName?: string; stream: MediaStream }) {
  return (
    <div className="video-container">
      <Video srcObject={stream} autoPlay />
      {playerName && <div className="player-name">{playerName}</div>}
    </div>
  )
}

export default function ComputerDialog() {
  const dispatch = useAppDispatch()
  const playerNameMap = useAppSelector((state) => state.user.playerNameMap)
  const shareScreenManager = useAppSelector((state) => state.computer.shareScreenManager)
  const myStream = useAppSelector((state) => state.computer.myStream)
  const peerStreams = useAppSelector((state) => state.computer.peerStreams)

  const peerEntries = [...peerStreams.entries()]
  const isSomeoneSharing = myStream !== null || peerEntries.length > 0
  const isISharingMyScreen = myStream !== null

  // Determine who is sharing for the header label
  let sharingName: string | null = null
  if (isISharingMyScreen) {
    sharingName = 'You'
  } else if (peerEntries.length > 0) {
    const [firstId] = peerEntries[0]
    sharingName = playerNameMap.get(firstId) ?? 'Someone'
  }

  // Main presenter: my stream takes priority, otherwise first peer
  const presenterStream = myStream ?? (peerEntries.length > 0 ? peerEntries[0][1].stream : null)
  const presenterName = myStream ? 'You' : (peerEntries.length > 0 ? (playerNameMap.get(peerEntries[0][0]) ?? 'Unknown') : null)

  // Thumbnails: peers who are not the main presenter
  const thumbnailPeers = myStream ? peerEntries : peerEntries.slice(1)

  return (
    <Backdrop>
      <Wrapper>
        <IconButton
          aria-label="close dialog"
          className="close"
          onClick={() => dispatch(closeComputerDialog())}
        >
          <CloseIcon />
        </IconButton>

        <Header>
          <Title>Screen Sharing</Title>
          {isSomeoneSharing && (
            <>
              <LiveBadge>LIVE</LiveBadge>
              <SharingName>{sharingName} is sharing</SharingName>
            </>
          )}
        </Header>

        <Toolbar>
          {isISharingMyScreen ? (
            <>
              <Button
                variant="contained"
                color="error"
                onClick={() => shareScreenManager?.stopScreenShare()}
              >
                Stop sharing
              </Button>
              <YouSharingBadge>You are sharing your screen</YouSharingBadge>
            </>
          ) : (
            <Button
              variant="contained"
              color="secondary"
              disabled={isSomeoneSharing}
              onClick={() => shareScreenManager?.startScreenShare()}
            >
              {isSomeoneSharing ? 'Someone is sharing' : 'Share Screen'}
            </Button>
          )}
        </Toolbar>

        {presenterStream ? (
          <>
            <MainPresenter>
              <Video srcObject={presenterStream} autoPlay />
              {presenterName && <div className="player-name">{presenterName}</div>}
            </MainPresenter>

            {thumbnailPeers.length > 0 && (
              <ThumbnailStrip>
                {thumbnailPeers.map(([id, { stream }]) => {
                  const name = playerNameMap.get(id)
                  return (
                    <Thumbnail key={id}>
                      <Video srcObject={stream} autoPlay />
                      {name && <div className="player-name">{name}</div>}
                    </Thumbnail>
                  )
                })}
              </ThumbnailStrip>
            )}
          </>
        ) : (
          <EmptyState>No one is sharing their screen yet.</EmptyState>
        )}
      </Wrapper>
    </Backdrop>
  )
}
