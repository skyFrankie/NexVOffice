import { Command } from '@colyseus/command'
import { Client } from 'colyseus'
import { IOfficeState } from '../../../types/IOfficeState'
import { ChatMessage } from '../schema/OfficeState'
import { Message } from '../../../types/Messages'
import { AuthPayload } from '../../auth/service'
import { db } from '../../db/connection'
import { officeSettings, chatMessages as chatMessagesTable, chatChannels } from '../../db/schema'
import { eq } from 'drizzle-orm'

const BEAT_COOLDOWN_MS = 3000
const DEFAULT_BEAT_DAMAGE = 10
const PROXIMITY_THRESHOLD = 96

type Payload = {
  client: Client
  targetId: string
}

export default class BeatPlayerCommand extends Command<IOfficeState, Payload> {
  async execute(data: Payload) {
    const { client, targetId } = data

    const attacker = this.room.state.players.get(client.sessionId)
    const target = this.room.state.players.get(targetId)

    if (!attacker || !target) return
    if (client.sessionId === targetId) return
    if (target.isNpc) return

    // Proximity check
    const dx = attacker.x - target.x
    const dy = attacker.y - target.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    if (distance > PROXIMITY_THRESHOLD) return

    // Cooldown check
    const now = Date.now()
    if (now - attacker.lastBeatAt < BEAT_COOLDOWN_MS) return

    // Read beat damage from office_settings if available
    let beatDamage = DEFAULT_BEAT_DAMAGE
    try {
      const settings = await db
        .select({ value: officeSettings.value })
        .from(officeSettings)
        .where(eq(officeSettings.key, 'beat_damage'))
        .limit(1)
      if (settings.length > 0) {
        const val = settings[0].value
        if (typeof val === 'number') beatDamage = val
        else if (typeof val === 'object' && val !== null && 'value' in val) {
          beatDamage = Number((val as any).value) || DEFAULT_BEAT_DAMAGE
        }
      }
    } catch {
      // use default
    }

    // Apply damage
    target.hp = Math.max(0, target.hp - beatDamage)
    attacker.lastBeatAt = now

    // Broadcast HP_UPDATE to all clients
    this.room.broadcast(Message.HP_UPDATE, {
      userId: targetId,
      hp: target.hp,
      maxHp: target.maxHp,
    })

    // Post chat notification to public channel
    const chatMessages = this.room.state.chatMessages
    if (chatMessages) {
      if (chatMessages.length >= 100) chatMessages.shift()
      const notif = new ChatMessage()
      notif.author = 'System'
      notif.content = `${attacker.name} beat ${target.name}! (-${beatDamage} HP)`
      chatMessages.push(notif)
    }

    // Broadcast beat notification as a chat message to all clients
    this.room.broadcast(Message.ADD_CHAT_MESSAGE, {
      clientId: 'system',
      content: `${attacker.name} beat ${target.name}! (-${beatDamage} HP)`,
    })

    // Persist chat notification to public channel (fire-and-forget)
    db.select({ id: chatChannels.id })
      .from(chatChannels)
      .where(eq(chatChannels.type, 'public'))
      .limit(1)
      .then(async (channels) => {
        if (channels.length > 0) {
          await db.insert(chatMessagesTable).values({
            channelId: channels[0].id,
            senderId: (client.auth as AuthPayload)?.id,
            content: `${attacker.name} beat ${target.name}! (-${beatDamage} HP)`,
          })
        }
      })
      .catch(err => console.error('Failed to persist beat notification:', err))
  }
}
