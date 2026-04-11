import { Message } from '../../../types/Messages'
import { phaserEvents, Event } from '../events/EventCenter'

export interface NPCMessage {
  role: 'user' | 'npc'
  content: string
  timestamp: number
}

type ResponseCallback = (npcId: string, content: string) => void
type ConversationEndCallback = (npcId: string) => void
type TypingCallback = (npcId: string, isTyping: boolean) => void

class NPCService {
  private room: any = null
  private activeNpcId: string | null = null
  private activeNpcName: string = ''
  private messages: NPCMessage[] = []

  private onResponseCallbacks: ResponseCallback[] = []
  private onConversationEndCallbacks: ConversationEndCallback[] = []
  private onTypingCallbacks: TypingCallback[] = []

  get isInConversation() {
    return this.activeNpcId !== null
  }

  get currentNpcId() {
    return this.activeNpcId
  }

  get currentNpcName() {
    return this.activeNpcName
  }

  get currentMessages() {
    return [...this.messages]
  }

  setRoom(room: any) {
    this.room = room

    // Listen for NPC_RESPONSE messages from server
    this.room.onMessage(Message.NPC_RESPONSE, (data: { npcId: string; content: string }) => {
      const { npcId, content } = data

      // Stop typing indicator
      this.notifyTyping(npcId, false)
      phaserEvents.emit(Event.NPC_RESPONSE, npcId, content)

      // Store message
      this.messages.push({ role: 'npc', content, timestamp: Date.now() })
      this.onResponseCallbacks.forEach((cb) => cb(npcId, content))
    })

    // Listen for conversation end acknowledgement from server
    this.room.onMessage(Message.END_NPC_CONVERSATION, (data: { npcId: string }) => {
      const { npcId } = data
      this.handleConversationEnd(npcId)
    })
  }

  startConversation(npcId: string, npcName: string) {
    if (!this.room) return
    this.activeNpcId = npcId
    this.activeNpcName = npcName
    this.messages = []
    this.room.send(Message.START_NPC_CONVERSATION, { npcId })
    phaserEvents.emit(Event.NPC_INTERACTION_START, npcId)
  }

  sendMessage(content: string) {
    if (!this.room || !this.activeNpcId) return
    const npcId = this.activeNpcId

    // Store user message
    this.messages.push({ role: 'user', content, timestamp: Date.now() })

    // Show typing indicator
    this.notifyTyping(npcId, true)

    this.room.send(Message.NPC_MESSAGE, { npcId, content })
  }

  endConversation() {
    if (!this.room || !this.activeNpcId) return
    const npcId = this.activeNpcId
    this.room.send(Message.END_NPC_CONVERSATION, { npcId })
    this.handleConversationEnd(npcId)
  }

  private handleConversationEnd(npcId: string) {
    this.activeNpcId = null
    this.activeNpcName = ''
    this.messages = []
    phaserEvents.emit(Event.NPC_INTERACTION_END, npcId)
    this.onConversationEndCallbacks.forEach((cb) => cb(npcId))
  }

  private notifyTyping(npcId: string, isTyping: boolean) {
    this.onTypingCallbacks.forEach((cb) => cb(npcId, isTyping))
  }

  mentionNpc(npcName: string, content: string, roomId: string) {
    if (!this.room) return
    this.room.send(Message.MENTION_NPC, { npcName, content, roomId })
  }

  onResponse(cb: ResponseCallback) {
    this.onResponseCallbacks.push(cb)
    return () => {
      this.onResponseCallbacks = this.onResponseCallbacks.filter((c) => c !== cb)
    }
  }

  onConversationEnd(cb: ConversationEndCallback) {
    this.onConversationEndCallbacks.push(cb)
    return () => {
      this.onConversationEndCallbacks = this.onConversationEndCallbacks.filter((c) => c !== cb)
    }
  }

  onTyping(cb: TypingCallback) {
    this.onTypingCallbacks.push(cb)
    return () => {
      this.onTypingCallbacks = this.onTypingCallbacks.filter((c) => c !== cb)
    }
  }
}

export const npcService = new NPCService()
export default npcService
