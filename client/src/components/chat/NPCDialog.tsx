import React, { useRef, useState, useEffect, useCallback } from 'react'
import styled, { keyframes } from 'styled-components'
import IconButton from '@mui/material/IconButton'
import CloseIcon from '@mui/icons-material/Close'
import SendIcon from '@mui/icons-material/Send'
import SmartToyIcon from '@mui/icons-material/SmartToy'

import { useNPC } from '../../hooks/useNPC'
import { NPCMessage } from '../../services/NPCService'

const Backdrop = styled.div`
  position: fixed;
  top: 50%;
  right: 20px;
  transform: translateY(-50%);
  width: 380px;
  height: 520px;
  display: flex;
  flex-direction: column;
  background: #1a1a2e;
  border: 1px solid #42eacb44;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  z-index: 1000;
`

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: #0f0f1e;
  border-bottom: 1px solid #333;
  flex-shrink: 0;
`

const AvatarWrapper = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #2a2a4a;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  svg {
    color: #42eacb;
    font-size: 20px;
  }
`

const HeaderInfo = styled.div`
  flex: 1;
  min-width: 0;
`

const NpcName = styled.div`
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const TypeBadge = styled.span<{ npctype: 'agent' | 'ghost' }>`
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: ${({ npctype }) => (npctype === 'agent' ? '#42eacb22' : '#88888822')};
  color: ${({ npctype }) => (npctype === 'agent' ? '#42eacb' : '#aaaaaa')};
  border: 1px solid ${({ npctype }) => (npctype === 'agent' ? '#42eacb66' : '#88888866')};
`

const MessageList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: #333;
    border-radius: 4px;
  }
`

const MessageBubble = styled.div<{ role: 'user' | 'npc' }>`
  max-width: 85%;
  padding: 8px 12px;
  border-radius: ${({ role }) =>
    role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px'};
  background: ${({ role }) => (role === 'user' ? '#42eacb22' : '#2a2a3e')};
  border: 1px solid ${({ role }) => (role === 'user' ? '#42eacb44' : '#444')};
  align-self: ${({ role }) => (role === 'user' ? 'flex-end' : 'flex-start')};
  font-size: 13px;
  color: #eee;
  line-height: 1.5;
  word-break: break-word;
`

const MessageMeta = styled.div<{ role: 'user' | 'npc' }>`
  font-size: 10px;
  color: #666;
  margin-top: 2px;
  text-align: ${({ role }) => (role === 'user' ? 'right' : 'left')};
  align-self: ${({ role }) => (role === 'user' ? 'flex-end' : 'flex-start')};
`

const dotBounce = keyframes`
  0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
  40% { transform: translateY(-4px); opacity: 1; }
`

const TypingIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  background: #2a2a3e;
  border: 1px solid #444;
  border-radius: 12px 12px 12px 4px;
  align-self: flex-start;
  width: fit-content;
`

const TypingDot = styled.span<{ delay: number }>`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #42eacb;
  display: inline-block;
  animation: ${dotBounce} 1.2s infinite ease-in-out;
  animation-delay: ${({ delay }) => delay}ms;
`

const InputArea = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: #0f0f1e;
  border-top: 1px solid #333;
  flex-shrink: 0;
`

const ChatInput = styled.input`
  flex: 1;
  background: #2a2a3e;
  border: 1px solid #42eacb44;
  border-radius: 8px;
  padding: 8px 12px;
  color: #eee;
  font-size: 13px;
  outline: none;

  &::placeholder {
    color: #555;
  }

  &:focus {
    border-color: #42eacb88;
  }
`

const SendButton = styled.button`
  background: #42eacb22;
  border: 1px solid #42eacb66;
  border-radius: 8px;
  padding: 8px 10px;
  color: #42eacb;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;

  &:hover:not(:disabled) {
    background: #42eacb44;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  svg {
    font-size: 18px;
  }
`

const timeFormatter = new Intl.DateTimeFormat('en', { timeStyle: 'short' })

function MessageItem({ msg }: { msg: NPCMessage }) {
  return (
    <>
      <MessageBubble role={msg.role}>{msg.content}</MessageBubble>
      <MessageMeta role={msg.role}>{timeFormatter.format(msg.timestamp)}</MessageMeta>
    </>
  )
}

interface NPCDialogProps {
  npcType?: 'agent' | 'ghost'
}

export default function NPCDialog({ npcType = 'agent' }: NPCDialogProps) {
  const { isInConversation, currentNpcName, messages, sendMessage, endConversation, isNpcTyping } =
    useNPC()

  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isNpcTyping, scrollToBottom])

  useEffect(() => {
    if (isInConversation) {
      inputRef.current?.focus()
    }
  }, [isInConversation])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isInConversation) {
        endConversation()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isInConversation, endConversation])

  if (!isInConversation) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const val = inputValue.trim()
    if (!val || isNpcTyping) return
    sendMessage(val)
    setInputValue('')
  }

  return (
    <Backdrop>
      <Header>
        <AvatarWrapper>
          <SmartToyIcon />
        </AvatarWrapper>
        <HeaderInfo>
          <NpcName>{currentNpcName}</NpcName>
          <TypeBadge npctype={npcType}>{npcType}</TypeBadge>
        </HeaderInfo>
        <IconButton
          aria-label="close npc dialog"
          size="small"
          onClick={endConversation}
          sx={{ color: '#888', '&:hover': { color: '#eee' } }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Header>

      <MessageList>
        {messages.map((msg, i) => (
          <MessageItem key={i} msg={msg} />
        ))}
        {isNpcTyping && (
          <TypingIndicator>
            <TypingDot delay={0} />
            <TypingDot delay={200} />
            <TypingDot delay={400} />
          </TypingIndicator>
        )}
        <div ref={messagesEndRef} />
      </MessageList>

      <InputArea as="form" onSubmit={handleSubmit}>
        <ChatInput
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Type a message..."
          disabled={isNpcTyping}
        />
        <SendButton type="submit" disabled={isNpcTyping || !inputValue.trim()}>
          <SendIcon />
        </SendButton>
      </InputArea>
    </Backdrop>
  )
}
