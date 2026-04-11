import bcrypt from 'bcrypt'
import { Room, Client, ServerError } from 'colyseus'
import { authService, AuthPayload } from '../auth/service'
import { Dispatcher } from '@colyseus/command'
import { Player, OfficeState, Computer, Whiteboard } from './schema/OfficeState'
import { Message } from '../../types/Messages'
import { IRoomData } from '../../types/Rooms'
import { whiteboardRoomIds } from './schema/OfficeState'
import PlayerUpdateCommand from './commands/PlayerUpdateCommand'
import PlayerUpdateNameCommand from './commands/PlayerUpdateNameCommand'
import {
  ComputerAddUserCommand,
  ComputerRemoveUserCommand,
} from './commands/ComputerUpdateArrayCommand'
import {
  WhiteboardAddUserCommand,
  WhiteboardRemoveUserCommand,
} from './commands/WhiteboardUpdateArrayCommand'
import ChatMessageUpdateCommand from './commands/ChatMessageUpdateCommand'
import BeatPlayerCommand from './commands/BeatPlayerCommand'
import { db } from '../db/connection'
import { officeLayout, roomPlacements, roomTemplates, chatChannels, chatMessages as chatMessagesTable, npcAgents, playerStats } from '../db/schema'
import { eq, and, or, like } from 'drizzle-orm'
import { stitchMap, MapPlacement, RoomZone } from '../map/stitcher'
import { findPlayerZone } from '../map/zones'
import { RoomZoneState } from './schema/RoomZone'
import { NPCEngine } from '../npc/engine'
import { registerRoom, unregisterRoom } from './registry'

export class SkyOffice extends Room<OfficeState> {
  private dispatcher = new Dispatcher(this)
  private npcEngine = new NPCEngine()
  private mentionCooldowns = new Map<string, number>()
  private name: string
  private description: string
  private password: string | null = null
  private roomZones: RoomZone[] | null = null
  private publicChannelId: string | null = null

  async onCreate(options: IRoomData) {
    const { name, description, password, autoDispose } = options
    this.name = name
    this.description = description
    this.autoDispose = autoDispose

    let hasPassword = false
    if (password) {
      const salt = await bcrypt.genSalt(10)
      this.password = await bcrypt.hash(password, salt)
      hasPassword = true
    }
    this.setMetadata({ name, description, hasPassword })

    this.setState(new OfficeState())
    registerRoom(this as any)

    // Load map data for item and zone initialization
    try {
      const layouts = await db.select().from(officeLayout).limit(1)
      if (layouts.length > 0) {
        const layout = layouts[0]
        const placementsWithTemplates = await db
          .select({
            id: roomPlacements.id,
            templateId: roomPlacements.templateId,
            gridX: roomPlacements.gridX,
            gridY: roomPlacements.gridY,
            roomName: roomPlacements.roomName,
            templateName: roomTemplates.name,
            widthBlocks: roomTemplates.widthBlocks,
            heightBlocks: roomTemplates.heightBlocks,
            tileData: roomTemplates.tileData,
            features: roomTemplates.features,
          })
          .from(roomPlacements)
          .innerJoin(roomTemplates, eq(roomPlacements.templateId, roomTemplates.id))
          .where(eq(roomPlacements.layoutId, layout.id))

        const mapPlacements: MapPlacement[] = placementsWithTemplates.map(p => ({
          id: p.id,
          templateId: p.templateId,
          gridX: p.gridX,
          gridY: p.gridY,
          roomName: p.roomName,
          template: {
            name: p.templateName,
            widthBlocks: p.widthBlocks,
            heightBlocks: p.heightBlocks,
            tileData: p.tileData,
            features: (p.features as any) || { voice: false, screenshare: false, whiteboard: false, privateChat: false },
            itemSlots: ((p.features as any)?.itemSlots) || [],
          },
        }))

        const result = stitchMap(mapPlacements, layout.gridWidth, layout.gridHeight)

        // Create computers and whiteboards from item placements
        let computerIndex = 0
        let whiteboardIndex = 0
        for (const item of result.itemPlacements) {
          if (item.type === 'computer') {
            this.state.computers.set(String(computerIndex++), new Computer())
          } else if (item.type === 'whiteboard') {
            this.state.whiteboards.set(String(whiteboardIndex++), new Whiteboard())
          }
        }

        // Load zones into state
        for (const zone of result.zones) {
          const zoneState = new RoomZoneState()
          zoneState.roomId = zone.roomId
          zoneState.roomName = zone.roomName
          zoneState.x = zone.bounds.x
          zoneState.y = zone.bounds.y
          zoneState.w = zone.bounds.w
          zoneState.h = zone.bounds.h
          zoneState.voice = zone.features.voice
          zoneState.screenshare = zone.features.screenshare
          zoneState.whiteboard = zone.features.whiteboard
          zoneState.privateChat = zone.features.privateChat
          this.state.zones.set(zone.roomId, zoneState)
        }

        // Set spawn point
        this.state.spawnX = result.spawnPoint.x
        this.state.spawnY = result.spawnPoint.y

        // Store zones for server-side zone detection
        this.roomZones = result.zones

        console.log(`Map loaded: ${result.itemPlacements.length} items, ${result.zones.length} zones`)
      } else {
        // Fallback: no layout exists, create minimal defaults
        for (let i = 0; i < 5; i++) this.state.computers.set(String(i), new Computer())
        for (let i = 0; i < 3; i++) this.state.whiteboards.set(String(i), new Whiteboard())
        console.log('No layout found, using default items')
      }
    } catch (err) {
      console.error('Failed to load map data:', err)
      // Fallback to hard-coded
      for (let i = 0; i < 5; i++) this.state.computers.set(String(i), new Computer())
      for (let i = 0; i < 3; i++) this.state.whiteboards.set(String(i), new Whiteboard())
    }

    // Load public channel ID for message persistence
    try {
      const pubChannels = await db.select({ id: chatChannels.id })
        .from(chatChannels)
        .where(eq(chatChannels.type, 'public'))
        .limit(1)
      if (pubChannels.length > 0) {
        this.publicChannelId = pubChannels[0].id
      }
    } catch (err) {
      console.error('Failed to load public channel:', err)
    }

    // Initialize NPC Engine — spawn AI NPCs as synthetic players
    try {
      await this.npcEngine.init(this)
      console.log('[SkyOffice] NPC Engine initialized')
    } catch (err) {
      console.error('[SkyOffice] Failed to initialize NPC Engine:', err)
    }

    // when a player connect to a computer, add to the computer connectedUser array
    this.onMessage(Message.CONNECT_TO_COMPUTER, (client, message: { computerId: string }) => {
      this.dispatcher.dispatch(new ComputerAddUserCommand(), {
        client,
        computerId: message.computerId,
      })
    })

    // when a player disconnect from a computer, remove from the computer connectedUser array
    this.onMessage(Message.DISCONNECT_FROM_COMPUTER, (client, message: { computerId: string }) => {
      this.dispatcher.dispatch(new ComputerRemoveUserCommand(), {
        client,
        computerId: message.computerId,
      })
    })

    // when a player stop sharing screen
    this.onMessage(Message.STOP_SCREEN_SHARE, (client, message: { computerId: string }) => {
      const computer = this.state.computers.get(message.computerId)
      computer.connectedUser.forEach((id) => {
        this.clients.forEach((cli) => {
          if (cli.sessionId === id && cli.sessionId !== client.sessionId) {
            cli.send(Message.STOP_SCREEN_SHARE, client.sessionId)
          }
        })
      })
    })

    // when a player connect to a whiteboard, add to the whiteboard connectedUser array
    this.onMessage(Message.CONNECT_TO_WHITEBOARD, (client, message: { whiteboardId: string }) => {
      this.dispatcher.dispatch(new WhiteboardAddUserCommand(), {
        client,
        whiteboardId: message.whiteboardId,
      })
    })

    // when a player disconnect from a whiteboard, remove from the whiteboard connectedUser array
    this.onMessage(
      Message.DISCONNECT_FROM_WHITEBOARD,
      (client, message: { whiteboardId: string }) => {
        this.dispatcher.dispatch(new WhiteboardRemoveUserCommand(), {
          client,
          whiteboardId: message.whiteboardId,
        })
      }
    )

    // when receiving updatePlayer message, call the PlayerUpdateCommand
    this.onMessage(
      Message.UPDATE_PLAYER,
      (client, message: { x: number; y: number; anim: string }) => {
        this.dispatcher.dispatch(new PlayerUpdateCommand(), {
          client,
          x: message.x,
          y: message.y,
          anim: message.anim,
        })
        // Check zone changes
        if (this.roomZones) {
          const player = this.state.players.get(client.sessionId)
          if (player) {
            const newZone = findPlayerZone(message.x, message.y, this.roomZones)
            const newZoneId = newZone?.roomId || ''
            if (newZoneId !== player.currentZone) {
              const oldZoneId = player.currentZone
              player.currentZone = newZoneId
              if (oldZoneId) {
                client.send(Message.LEAVE_ZONE, { roomId: oldZoneId })
              }
              if (newZone) {
                client.send(Message.ENTER_ZONE, { zone: newZone })

                // Collect all other players currently in this zone
                const zoneMembers: string[] = []
                this.state.players.forEach((p, sessionId) => {
                  if (sessionId !== client.sessionId && p.currentZone === newZoneId) {
                    zoneMembers.push(sessionId)
                  }
                })

                // Tell the new player about existing zone members
                if (zoneMembers.length > 0) {
                  client.send(Message.ZONE_MEMBERS, { members: zoneMembers })
                }

                // Tell existing zone members about the new player
                this.clients.forEach(c => {
                  if (c.sessionId !== client.sessionId) {
                    const p = this.state.players.get(c.sessionId)
                    if (p && p.currentZone === newZoneId) {
                      c.send(Message.ZONE_MEMBERS, { members: [client.sessionId] })
                    }
                  }
                })
              }
            }
          }
        }
      }
    )

    // when receiving updatePlayerName message, call the PlayerUpdateNameCommand
    this.onMessage(Message.UPDATE_PLAYER_NAME, (client, message: { name: string }) => {
      this.dispatcher.dispatch(new PlayerUpdateNameCommand(), {
        client,
        name: message.name,
      })
    })

    // when a player is ready to connect, call the PlayerReadyToConnectCommand
    this.onMessage(Message.READY_TO_CONNECT, (client) => {
      const player = this.state.players.get(client.sessionId)
      if (player) player.readyToConnect = true
    })

    // when a player is ready to connect, call the PlayerReadyToConnectCommand
    this.onMessage(Message.VIDEO_CONNECTED, (client) => {
      const player = this.state.players.get(client.sessionId)
      if (player) player.videoConnected = true
    })

    // when a player disconnect a stream, broadcast the signal to the other player connected to the stream
    this.onMessage(Message.DISCONNECT_STREAM, (client, message: { clientId: string }) => {
      this.clients.forEach((cli) => {
        if (cli.sessionId === message.clientId) {
          cli.send(Message.DISCONNECT_STREAM, client.sessionId)
        }
      })
    })

    // when a player send a chat message, update the message array and broadcast to all connected clients except the sender
    this.onMessage(Message.ADD_CHAT_MESSAGE, (client, message: { content: string }) => {
      const content = typeof message.content === 'string' ? message.content.trim() : ''
      if (!content || content.length > 2000) return

      // update the message array (so that players join later can also see the message)
      this.dispatcher.dispatch(new ChatMessageUpdateCommand(), {
        client,
        content,
        channelId: this.publicChannelId || undefined,
        senderId: (client.auth as AuthPayload)?.id,
      })

      // broadcast to all currently connected clients except the sender (to render in-game dialog on top of the character)
      this.broadcast(
        Message.ADD_CHAT_MESSAGE,
        { clientId: client.sessionId, content },
        { except: client }
      )
    })

    // DM handler — uses targetId as session ID for real-time delivery,
    // resolves DB user IDs from auth for persistence (works even if target is offline)
    this.onMessage(Message.SEND_DM, (client, message: { targetId: string, content: string }) => {
      const content = typeof message.content === 'string' ? message.content.trim() : ''
      if (!content || content.length > 2000) return
      if (!message.targetId || typeof message.targetId !== 'string') return

      const sender = this.state.players.get(client.sessionId)
      if (!sender) return
      const senderId = (client.auth as AuthPayload)?.id
      if (!senderId) return

      // Find the target client by session ID (may be null if offline)
      const targetClient = this.clients.find(c => c.sessionId === message.targetId)

      // Resolve target's DB user ID from auth (works when target is online)
      const targetAuth = targetClient ? (targetClient.auth as AuthPayload) : null
      const targetUserId = targetAuth?.id

      // Persist to DB (fire-and-forget) — works even without targetUserId by looking up from channel
      if (targetUserId) {
        // Both users online — use sorted user IDs for channel name
        const channelName = `dm:${[senderId, targetUserId].sort().join(':')}`
        db.select({ id: chatChannels.id })
          .from(chatChannels)
          .where(and(eq(chatChannels.type, 'dm'), eq(chatChannels.name, channelName)))
          .limit(1)
          .then(async (channels) => {
            let channelId: string
            if (channels.length > 0) {
              channelId = channels[0].id
            } else {
              const result = await db.insert(chatChannels).values({
                type: 'dm',
                name: channelName,
              }).returning({ id: chatChannels.id })
              channelId = result[0].id
            }
            await db.insert(chatMessagesTable).values({
              channelId,
              senderId,
              content,
            })
          })
          .catch(err => console.error('Failed to persist DM:', err))
      } else {
        // Target offline — look up existing DM channel by sender's ID prefix
        db.select({ id: chatChannels.id, name: chatChannels.name })
          .from(chatChannels)
          .where(and(
            eq(chatChannels.type, 'dm'),
            or(
              like(chatChannels.name, `dm:${senderId}:%`),
              like(chatChannels.name, `dm:%:${senderId}`)
            )
          ))
          .then(async (channels) => {
            // Find the channel that also contains the target (if we can resolve via prior DM)
            // For now, skip persistence if we can't determine the channel — the message is still lost for offline targets
            // This will be fully resolved when we switch to DB user IDs for DM addressing
          })
          .catch(err => console.error('Failed to persist offline DM:', err))
      }

      // Forward to target client (if online)
      if (targetClient) {
        targetClient.send(Message.SEND_DM, {
          senderId: client.sessionId,
          senderName: sender.name,
          content,
        })
      }

      // Confirm back to sender
      client.send(Message.SEND_DM, {
        senderId: client.sessionId,
        senderName: sender.name,
        content,
        targetId: message.targetId,
      })
    })

    this.onMessage(Message.SEND_ROOM_MESSAGE, (client, message: { content: string }) => {
      const content = typeof message.content === 'string' ? message.content.trim() : ''
      if (!content || content.length > 2000) return

      const sender = this.state.players.get(client.sessionId)
      if (!sender || !sender.currentZone) return
      const senderId = (client.auth as AuthPayload)?.id

      // Persist to DB (fire-and-forget)
      if (senderId) {
        db.select({ id: chatChannels.id })
          .from(chatChannels)
          .where(and(eq(chatChannels.type, 'room'), eq(chatChannels.roomId, sender.currentZone)))
          .limit(1)
          .then(async (channels) => {
            if (channels.length > 0) {
              await db.insert(chatMessagesTable).values({
                channelId: channels[0].id,
                senderId,
                content,
              })
            }
          })
          .catch(err => console.error('Failed to persist room message:', err))
      }

      // Broadcast to all players in the same zone
      this.clients.forEach(c => {
        const p = this.state.players.get(c.sessionId)
        if (p && p.currentZone === sender.currentZone) {
          c.send(Message.SEND_ROOM_MESSAGE, {
            senderId: client.sessionId,
            senderName: sender.name,
            content,
            roomId: sender.currentZone,
          })
        }
      })
    })

    // @mention NPC in meeting room chat
    this.onMessage(Message.MENTION_NPC, async (client, message: { npcName: string; content: string }) => {
      if (!message.npcName || !message.content) return
      const content = String(message.content).slice(0, 500)
      const sender = this.state.players.get(client.sessionId)
      if (!sender || !sender.currentZone) return
      const userId = (client.auth as AuthPayload)?.id
      if (!userId) return

      // Rate limit: 1 mention per 3 seconds per user
      const now = Date.now()
      const lastMention = this.mentionCooldowns.get(userId) || 0
      if (now - lastMention < 3000) return
      this.mentionCooldowns.set(userId, now)

      // Find NPC by name
      const npcs = await db.select().from(npcAgents)
        .where(and(eq(npcAgents.name, message.npcName), eq(npcAgents.isActive, true)))
        .limit(1)
      if (npcs.length === 0) return

      // Collect participants in the zone
      const participants: string[] = []
      this.state.players.forEach((p, sid) => {
        if (p.currentZone === sender.currentZone) participants.push(p.name)
      })

      try {
        const response = await this.npcEngine.handleMention(
          npcs[0].id, sender.currentZone, content, participants, userId
        )
        // Broadcast NPC response to the room zone
        this.clients.forEach(c => {
          const p = this.state.players.get(c.sessionId)
          if (p && p.currentZone === sender.currentZone) {
            c.send(Message.NPC_RESPONSE, {
              npcId: npcs[0].id,
              npcName: npcs[0].name,
              content: response,
              isMention: true,
            })
          }
        })
      } catch (err) {
        console.error('[SkyOffice] NPC mention error:', err)
      }
    })

    this.onMessage(Message.START_PROXIMITY_CHAT, (_client, _message) => {
      // Reserved for future proximity chat feature
    })

    // Zone enter/leave/voice — handled via UPDATE_PLAYER zone detection above
    this.onMessage(Message.ENTER_ZONE, (_client, _message) => {})
    this.onMessage(Message.LEAVE_ZONE, (_client, _message) => {})
    this.onMessage(Message.JOIN_VOICE, (_client, _message) => {})
    this.onMessage(Message.LEAVE_VOICE, (_client, _message) => {})

    // NPC Conversation — Start
    this.onMessage(Message.START_NPC_CONVERSATION, async (client, message: { npcId: string }) => {
      if (!message.npcId) return
      const userId = (client.auth as AuthPayload)?.id
      if (!userId) return

      try {
        const result = await this.npcEngine.startNpcConversation(message.npcId, userId)
        client.send(Message.NPC_RESPONSE, {
          npcId: message.npcId,
          content: result.greeting,
          sessionId: result.sessionId,
        })
      } catch (err) {
        console.error('[SkyOffice] NPC start conversation error:', err)
      }
    })

    // NPC Conversation — Message
    this.onMessage(Message.NPC_MESSAGE, async (client, message: { npcId: string; content: string }) => {
      if (!message.npcId || !message.content) return
      const userId = (client.auth as AuthPayload)?.id
      if (!userId) return

      try {
        const response = await this.npcEngine.handleNpcMessage(message.npcId, userId, message.content)
        client.send(Message.NPC_RESPONSE, {
          npcId: message.npcId,
          content: response,
        })
      } catch (err) {
        console.error('[SkyOffice] NPC message error:', err)
      }
    })

    // NPC Conversation — End
    this.onMessage(Message.END_NPC_CONVERSATION, async (client, message: { npcId: string }) => {
      if (!message.npcId) return
      const userId = (client.auth as AuthPayload)?.id
      if (!userId) return

      try {
        await this.npcEngine.stopNpcConversation(message.npcId, userId)
      } catch (err) {
        console.error('[SkyOffice] NPC end conversation error:', err)
      }
    })

    // Gamification — Beat Player
    this.onMessage(Message.BEAT_PLAYER, (client, message: { targetUserId: string }) => {
      if (!message.targetUserId) return
      this.dispatcher.dispatch(new BeatPlayerCommand(), {
        client,
        targetId: message.targetUserId,
      })
    })

    // Tasks — client forwards notification after REST call succeeds
    this.onMessage(Message.TASK_ASSIGNED, (client, message: { assignedTo: string; taskId: string; title: string }) => {
      if (!message.assignedTo || !message.taskId) return
      // Forward to the assigned user if online
      this.clients.forEach(c => {
        const auth = c.auth as AuthPayload | null
        if (auth?.id === message.assignedTo && c.sessionId !== client.sessionId) {
          c.send(Message.TASK_ASSIGNED, message)
        }
      })
    })

    this.onMessage(Message.TASK_UPDATED, (client, message: { taskId: string; status: string }) => {
      if (!message.taskId) return
      // Broadcast task updates to all connected clients except sender
      this.broadcast(Message.TASK_UPDATED, message, { except: client })
    })
  }

  async onAuth(client: Client, options: { password?: string | null; token?: string }) {
    if (!options.token) {
      throw new ServerError(401, 'No token provided')
    }
    const user = await authService.verifyToken(options.token)
    if (!user) {
      throw new ServerError(401, 'Invalid or expired token')
    }

    if (this.password) {
      if (!options.password) {
        throw new ServerError(403, 'Password required')
      }
      const validPassword = await bcrypt.compare(options.password, this.password)
      if (!validPassword) {
        throw new ServerError(403, 'Password is incorrect!')
      }
    }

    return user
  }

  async onJoin(client: Client, options: any, auth: AuthPayload) {
    const player = new Player()
    player.name = auth.displayName
    player.anim = `${auth.avatar}_idle_down`
    player.x = this.state.spawnX
    player.y = this.state.spawnY

    // Load persisted HP from player_stats
    try {
      const stats = await db.select().from(playerStats).where(eq(playerStats.userId, auth.id)).limit(1)
      if (stats.length > 0) {
        player.hp = stats[0].hp
        player.maxHp = stats[0].maxHp
      } else {
        // First login — create player_stats row
        await db.insert(playerStats).values({ userId: auth.id, hp: 100, maxHp: 100 })
      }
    } catch (err) {
      console.error('Failed to load player stats:', err)
    }

    this.state.players.set(client.sessionId, player)
    client.send(Message.SEND_ROOM_DATA, {
      id: this.roomId,
      name: this.name,
      description: this.description,
    })
  }

  onLeave(client: Client, consented: boolean) {
    if (this.state.players.has(client.sessionId)) {
      this.state.players.delete(client.sessionId)
    }
    this.state.computers.forEach((computer) => {
      if (computer.connectedUser.has(client.sessionId)) {
        computer.connectedUser.delete(client.sessionId)
      }
    })
    this.state.whiteboards.forEach((whiteboard) => {
      if (whiteboard.connectedUser.has(client.sessionId)) {
        whiteboard.connectedUser.delete(client.sessionId)
      }
    })
  }

  onDispose() {
    this.state.whiteboards.forEach((whiteboard) => {
      if (whiteboardRoomIds.has(whiteboard.roomId)) whiteboardRoomIds.delete(whiteboard.roomId)
    })

    unregisterRoom(this as any)
    this.npcEngine.dispose()
    console.log('room', this.roomId, 'disposing...')
    this.dispatcher.stop()
  }
}
