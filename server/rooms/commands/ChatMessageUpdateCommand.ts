import { Command } from '@colyseus/command'
import { Client } from 'colyseus'
import { IOfficeState } from '../../../types/IOfficeState'
import { ChatMessage } from '../schema/OfficeState'
import { db } from '../../db/connection'
import { chatMessages as chatMessagesTable } from '../../db/schema'

type Payload = {
  client: Client
  content: string
  channelId?: string
  senderId?: string
}

export default class ChatMessageUpdateCommand extends Command<IOfficeState, Payload> {
  execute(data: Payload) {
    const { client, content } = data
    const player = this.room.state.players.get(client.sessionId)
    const chatMessages = this.room.state.chatMessages

    if (!chatMessages) return

    /**
     * Only allow server to store a maximum of 100 chat messages:
     * remove the first element before pushing a new one when array length is >= 100
     */
    if (chatMessages.length >= 100) chatMessages.shift()

    const newMessage = new ChatMessage()
    newMessage.author = player.name
    newMessage.content = content
    chatMessages.push(newMessage)

    if (data.channelId && data.senderId) {
      db.insert(chatMessagesTable).values({
        channelId: data.channelId,
        senderId: data.senderId,
        content,
      }).catch(err => console.error('Failed to persist chat message:', err))
    }
  }
}
