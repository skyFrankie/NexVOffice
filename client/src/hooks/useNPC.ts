import { useState, useEffect, useCallback } from 'react'
import npcService, { NPCMessage } from '../services/NPCService'

interface UseNPCResult {
  isInConversation: boolean
  currentNpcId: string | null
  currentNpcName: string
  messages: NPCMessage[]
  sendMessage: (content: string) => void
  endConversation: () => void
  isNpcTyping: boolean
}

export function useNPC(): UseNPCResult {
  const [isInConversation, setIsInConversation] = useState(npcService.isInConversation)
  const [currentNpcId, setCurrentNpcId] = useState<string | null>(npcService.currentNpcId)
  const [currentNpcName, setCurrentNpcName] = useState(npcService.currentNpcName)
  const [messages, setMessages] = useState<NPCMessage[]>(npcService.currentMessages)
  const [isNpcTyping, setIsNpcTyping] = useState(false)

  useEffect(() => {
    const unsubResponse = npcService.onResponse((npcId, content) => {
      setMessages(npcService.currentMessages)
      setIsNpcTyping(false)
    })

    const unsubEnd = npcService.onConversationEnd((npcId) => {
      setIsInConversation(false)
      setCurrentNpcId(null)
      setCurrentNpcName('')
      setMessages([])
      setIsNpcTyping(false)
    })

    const unsubTyping = npcService.onTyping((npcId, typing) => {
      setIsNpcTyping(typing)
    })

    return () => {
      unsubResponse()
      unsubEnd()
      unsubTyping()
    }
  }, [])

  // Sync state when conversation starts from outside (e.g. Phaser R-key press)
  useEffect(() => {
    const interval = setInterval(() => {
      const inConv = npcService.isInConversation
      const npcId = npcService.currentNpcId
      const npcName = npcService.currentNpcName

      setIsInConversation(inConv)
      if (npcId !== currentNpcId) {
        setCurrentNpcId(npcId)
        setCurrentNpcName(npcName)
        setMessages(npcService.currentMessages)
      }
    }, 100)

    return () => clearInterval(interval)
  }, [currentNpcId])

  const sendMessage = useCallback((content: string) => {
    npcService.sendMessage(content)
    setMessages(npcService.currentMessages)
    setIsNpcTyping(true)
  }, [])

  const endConversation = useCallback(() => {
    npcService.endConversation()
  }, [])

  return {
    isInConversation,
    currentNpcId,
    currentNpcName,
    messages,
    sendMessage,
    endConversation,
    isNpcTyping,
  }
}
