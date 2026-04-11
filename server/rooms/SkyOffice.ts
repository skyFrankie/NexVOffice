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
import { db } from '../db/connection'
import { officeLayout, roomPlacements, roomTemplates } from '../db/schema'
import { eq } from 'drizzle-orm'
import { stitchMap, MapPlacement, RoomZone } from '../map/stitcher'
import { findPlayerZone } from '../map/zones'
import { RoomZoneState } from './schema/RoomZone'

export class SkyOffice extends Room<OfficeState> {
  private dispatcher = new Dispatcher(this)
  private name: string
  private description: string
  private password: string | null = null
  private roomZones: RoomZone[] | null = null

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

      // update the message array (so that players join later can also see the message)
      this.dispatcher.dispatch(new ChatMessageUpdateCommand(), {
        client,
        content: message.content,
      })

      // broadcast to all currently connected clients except the sender (to render in-game dialog on top of the character)
      this.broadcast(
        Message.ADD_CHAT_MESSAGE,
        { clientId: client.sessionId, content: message.content },
        { except: client }
      )
    })

    // TODO: Phase 3 — Chat
    this.onMessage(Message.SEND_DM, (client, message) => {
      // TODO: Phase 3
    })

    this.onMessage(Message.SEND_ROOM_MESSAGE, (client, message) => {
      // TODO: Phase 3
    })

    this.onMessage(Message.MENTION_NPC, (client, message) => {
      // TODO: Phase 3
    })

    this.onMessage(Message.START_PROXIMITY_CHAT, (client, message) => {
      // TODO: Phase 3
    })

    // TODO: Phase 3 — Zones
    this.onMessage(Message.ENTER_ZONE, (client, message) => {
      // TODO: Phase 3
    })

    this.onMessage(Message.LEAVE_ZONE, (client, message) => {
      // TODO: Phase 3
    })

    this.onMessage(Message.JOIN_VOICE, (client, message) => {
      // TODO: Phase 3
    })

    this.onMessage(Message.LEAVE_VOICE, (client, message) => {
      // TODO: Phase 3
    })

    // TODO: Phase 3 — NPC
    this.onMessage(Message.START_NPC_CONVERSATION, (client, message) => {
      // TODO: Phase 3
    })

    this.onMessage(Message.NPC_MESSAGE, (client, message) => {
      // TODO: Phase 3
    })

    this.onMessage(Message.END_NPC_CONVERSATION, (client, message) => {
      // TODO: Phase 3
    })

    // TODO: Phase 3 — Gamification
    this.onMessage(Message.BEAT_PLAYER, (client, message) => {
      // TODO: Phase 3
    })

    // TODO: Phase 3 — Tasks
    this.onMessage(Message.TASK_ASSIGNED, (client, message) => {
      // TODO: Phase 3
    })

    this.onMessage(Message.TASK_UPDATED, (client, message) => {
      // TODO: Phase 3
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

  onJoin(client: Client, options: any, auth: AuthPayload) {
    const player = new Player()
    player.name = auth.displayName
    player.anim = `${auth.avatar}_idle_down`
    player.x = this.state.spawnX
    player.y = this.state.spawnY
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

    console.log('room', this.roomId, 'disposing...')
    this.dispatcher.stop()
  }
}
