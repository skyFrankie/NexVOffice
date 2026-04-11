import React, { useRef, useState, useEffect } from 'react'
import styled from 'styled-components'
import Box from '@mui/material/Box'
import Fab from '@mui/material/Fab'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'
import InputBase from '@mui/material/InputBase'
import Badge from '@mui/material/Badge'
import InsertEmoticonIcon from '@mui/icons-material/InsertEmoticon'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import CloseIcon from '@mui/icons-material/Close'
import 'emoji-mart/css/emoji-mart.css'
import { Picker } from 'emoji-mart'

import chatService from '../../services/ChatService'
import DMList from './DMList'

import { getColorByString } from '../../util'
import { useAppDispatch, useAppSelector } from '../../hooks'
import {
  MessageType,
  setActiveTab,
  setActiveDmPartner,
  setFocused,
  setShowChat,
  ChatMessageEntry,
} from '../../stores/ChatStore'

const Backdrop = styled.div`
  position: fixed;
  bottom: 60px;
  left: 0;
  height: 400px;
  width: 500px;
  max-height: 50%;
  max-width: 100%;
`

const Wrapper = styled.div`
  position: relative;
  height: 100%;
  padding: 16px;
  display: flex;
  flex-direction: column;
`

const FabWrapper = styled.div`
  margin-top: auto;
`

const ChatHeader = styled.div`
  position: relative;
  height: 35px;
  background: #000000a7;
  border-radius: 10px 10px 0px 0px;

  h3 {
    color: #fff;
    margin: 7px;
    font-size: 17px;
    text-align: center;
  }

  .close {
    position: absolute;
    top: 0;
    right: 0;
  }
`

const TabBar = styled.div`
  display: flex;
  background: #1a1a1a;
  border-bottom: 1px solid #333;
`

const Tab = styled.div<{ active: boolean }>`
  flex: 1;
  padding: 8px 12px;
  text-align: center;
  color: ${({ active }) => (active ? '#42eacb' : '#888')};
  font-size: 13px;
  font-weight: ${({ active }) => (active ? 'bold' : 'normal')};
  cursor: pointer;
  border-bottom: 2px solid ${({ active }) => (active ? '#42eacb' : 'transparent')};
  transition: all 0.2s;

  &:hover {
    color: #42eacb;
    background: #2a2a2a;
  }
`

const ChatBox = styled(Box)`
  height: 100%;
  width: 100%;
  overflow: auto;
  background: #2c2c2c;
  border: 1px solid #00000029;
`

const MessageWrapper = styled.div`
  display: flex;
  flex-wrap: wrap;
  padding: 0px 2px;

  p {
    margin: 3px;
    text-shadow: 0.3px 0.3px black;
    font-size: 15px;
    font-weight: bold;
    line-height: 1.4;
    overflow-wrap: anywhere;
  }

  span {
    color: white;
    font-weight: normal;
  }

  .notification {
    color: grey;
    font-weight: normal;
  }

  :hover {
    background: #3a3a3a;
  }
`

const InputWrapper = styled.form`
  box-shadow: 10px 10px 10px #00000018;
  border: 1px solid #42eacb;
  border-radius: 0px 0px 10px 10px;
  display: flex;
  flex-direction: row;
  background: linear-gradient(180deg, #000000c1, #242424c0);
`

const InputTextField = styled(InputBase)`
  border-radius: 0px 0px 10px 10px;
  input {
    padding: 5px;
  }
`

const EmojiPickerWrapper = styled.div`
  position: absolute;
  bottom: 54px;
  right: 16px;
`

const DmHeader = styled.div`
  display: flex;
  align-items: center;
  padding: 4px 8px;
  background: #1a1a1a;
  border-bottom: 1px solid #333;
  font-size: 13px;
  color: #42eacb;

  button {
    background: none;
    border: none;
    color: #888;
    cursor: pointer;
    padding: 2px 6px;
    font-size: 12px;
    margin-left: auto;

    &:hover {
      color: #42eacb;
    }
  }
`

const dateFormatter = new Intl.DateTimeFormat('en', {
  timeStyle: 'short',
  dateStyle: 'short',
})

const Message = ({ chatMessage, messageType }: ChatMessageEntry) => {
  const [tooltipOpen, setTooltipOpen] = useState(false)

  return (
    <MessageWrapper
      onMouseEnter={() => setTooltipOpen(true)}
      onMouseLeave={() => setTooltipOpen(false)}
    >
      <Tooltip
        open={tooltipOpen}
        title={dateFormatter.format(chatMessage.createdAt)}
        placement="right"
        arrow
      >
        {messageType === MessageType.REGULAR_MESSAGE ? (
          <p style={{ color: getColorByString(chatMessage.author) }}>
            {chatMessage.author}: <span>{chatMessage.content}</span>
          </p>
        ) : (
          <p className="notification">
            {chatMessage.author} {chatMessage.content}
          </p>
        )}
      </Tooltip>
    </MessageWrapper>
  )
}

export default function ChatPanel() {
  const [inputValue, setInputValue] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [readyToSubmit, setReadyToSubmit] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dispatch = useAppDispatch()

  const activeTab = useAppSelector((state) => state.chat.activeTab)
  const publicMessages = useAppSelector((state) => state.chat.publicMessages)
  const roomMessages = useAppSelector((state) => state.chat.roomMessages)
  const dmChannels = useAppSelector((state) => state.chat.dmChannels)
  const activeDmPartnerId = useAppSelector((state) => state.chat.activeDmPartnerId)
  const currentRoomId = useAppSelector((state) => state.chat.currentRoomId)
  const currentRoomName = useAppSelector((state) => state.chat.currentRoomName)
  const focused = useAppSelector((state) => state.chat.focused)
  const showChat = useAppSelector((state) => state.chat.showChat)

  const currentMessages: ChatMessageEntry[] =
    activeTab === 'public'
      ? publicMessages
      : activeTab === 'room'
      ? roomMessages
      : activeDmPartnerId
      ? dmChannels[activeDmPartnerId]?.messages ?? []
      : []

  const totalUnread = Object.values(dmChannels).reduce((sum, ch) => sum + ch.unread, 0)

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      inputRef.current?.blur()
      dispatch(setShowChat(false))
    }
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!readyToSubmit) {
      setReadyToSubmit(true)
      return
    }
    inputRef.current?.blur()

    const val = inputValue.trim()
    setInputValue('')
    if (!val) return

    if (activeTab === 'public') {
      chatService.sendPublicMessage(val)
    } else if (activeTab === 'room') {
      chatService.sendRoomMessage(val)
    } else if (activeTab === 'dm' && activeDmPartnerId) {
      chatService.sendDm(activeDmPartnerId, val)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (focused) {
      inputRef.current?.focus()
    }
  }, [focused])

  useEffect(() => {
    scrollToBottom()
  }, [currentMessages, showChat])

  const showDmList = activeTab === 'dm' && !activeDmPartnerId

  return (
    <Backdrop>
      <Wrapper>
        {showChat ? (
          <>
            <ChatHeader>
              <h3>
                {activeTab === 'room' && currentRoomName
                  ? currentRoomName
                  : activeTab === 'dm' && activeDmPartnerId && dmChannels[activeDmPartnerId]
                  ? dmChannels[activeDmPartnerId].partnerName
                  : 'Chat'}
              </h3>
              <IconButton
                aria-label="close dialog"
                className="close"
                onClick={() => dispatch(setShowChat(false))}
                size="small"
              >
                <CloseIcon />
              </IconButton>
            </ChatHeader>
            <TabBar>
              <Tab active={activeTab === 'public'} onClick={() => dispatch(setActiveTab('public'))}>
                Public
              </Tab>
              {currentRoomId && (
                <Tab active={activeTab === 'room'} onClick={() => dispatch(setActiveTab('room'))}>
                  Room
                </Tab>
              )}
              <Tab active={activeTab === 'dm'} onClick={() => dispatch(setActiveTab('dm'))}>
                <Badge badgeContent={totalUnread} color="error" max={99}>
                  DMs
                </Badge>
              </Tab>
            </TabBar>
            {activeTab === 'dm' && activeDmPartnerId && (
              <DmHeader>
                <span>{dmChannels[activeDmPartnerId]?.partnerName}</span>
                <button onClick={() => dispatch(setActiveDmPartner(null))}>Back</button>
              </DmHeader>
            )}
            {showDmList ? (
              <DMList />
            ) : (
              <ChatBox>
                {currentMessages.map((entry, index) => (
                  <Message
                    chatMessage={entry.chatMessage}
                    messageType={entry.messageType}
                    key={index}
                  />
                ))}
                <div ref={messagesEndRef} />
                {showEmojiPicker && (
                  <EmojiPickerWrapper>
                    <Picker
                      theme="dark"
                      showSkinTones={false}
                      showPreview={false}
                      onSelect={(emoji) => {
                        setInputValue(inputValue + emoji.native)
                        setShowEmojiPicker(!showEmojiPicker)
                        dispatch(setFocused(true))
                      }}
                      exclude={['recent', 'flags']}
                    />
                  </EmojiPickerWrapper>
                )}
              </ChatBox>
            )}
            {!showDmList && (
              <InputWrapper onSubmit={handleSubmit}>
                <InputTextField
                  inputRef={inputRef}
                  autoFocus={focused}
                  fullWidth
                  placeholder={
                    activeTab === 'dm' && !activeDmPartnerId
                      ? 'Select a player to DM'
                      : 'Press Enter to chat'
                  }
                  value={inputValue}
                  onKeyDown={handleKeyDown}
                  onChange={handleChange}
                  onFocus={() => {
                    if (!focused) {
                      dispatch(setFocused(true))
                      setReadyToSubmit(true)
                    }
                  }}
                  onBlur={() => {
                    dispatch(setFocused(false))
                    setReadyToSubmit(false)
                  }}
                />
                <IconButton
                  aria-label="emoji"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                >
                  <InsertEmoticonIcon />
                </IconButton>
              </InputWrapper>
            )}
          </>
        ) : (
          <FabWrapper>
            <Fab
              color="secondary"
              aria-label="showChat"
              onClick={() => {
                dispatch(setShowChat(true))
                dispatch(setFocused(true))
              }}
            >
              <Badge badgeContent={totalUnread} color="error" max={99}>
                <ChatBubbleOutlineIcon />
              </Badge>
            </Fab>
          </FabWrapper>
        )}
      </Wrapper>
    </Backdrop>
  )
}
