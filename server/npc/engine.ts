import { Room } from 'colyseus'
import { db } from '../db/connection'
import { npcAgents } from '../db/schema'
import { eq } from 'drizzle-orm'
import { Player, OfficeState } from '../rooms/schema/OfficeState'
import {
  stay_at_desk,
  wander_room,
  wander_freely,
  face_user,
  go_to_meeting,
  clearWanderState,
  Bounds,
} from './behavior'
import {
  startConversation,
  handleMessage,
  endConversation,
  setOnEndCallback,
} from './conversation'

const BEHAVIOR_TICK_MS = 500
const HEARTBEAT_MS = 30000

interface NPCRecord {
  id: string
  name: string
  avatar: string
  type: string
  spawnX: number
  spawnY: number
  behavior: string
}

// npcId → session player key in room state (same as npcId for NPCs)
const npcPlayerKeys = new Map<string, string>()

class NPCEngine {
  private room: Room<OfficeState> | null = null
  private behaviorTimer: ReturnType<typeof setInterval> | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private loadedNpcs: NPCRecord[] = []
  private mapBounds: Bounds = { x: 0, y: 0, w: 2000, h: 2000 }

  async init(room: Room<OfficeState>): Promise<void> {
    this.room = room

    setOnEndCallback((sessionId) => {
      // When a conversation ends, face the NPC back to idle
      const [npcId] = sessionId.split(':')
      const key = npcPlayerKeys.get(npcId)
      if (key && this.room) {
        const npcPlayer = this.room.state.players.get(key)
        if (npcPlayer) stay_at_desk(npcPlayer)
      }
    })

    await this.loadAndSpawnAll()

    this.behaviorTimer = setInterval(() => this.behaviorTick(), BEHAVIOR_TICK_MS)
    this.heartbeatTimer = setInterval(() => this.heartbeat(), HEARTBEAT_MS)
  }

  private async loadAndSpawnAll(): Promise<void> {
    const npcs = await db
      .select()
      .from(npcAgents)
      .where(eq(npcAgents.isActive, true))

    this.loadedNpcs = npcs.map((n) => ({
      id: n.id,
      name: n.name,
      avatar: n.avatar,
      type: n.type,
      spawnX: n.spawnX ?? 400,
      spawnY: n.spawnY ?? 400,
      behavior: 'stay_at_desk',
    }))

    for (const npc of this.loadedNpcs) {
      this.spawnNpc(npc)
    }
  }

  spawnNpc(npc: NPCRecord): void {
    if (!this.room) return

    const player = new Player()
    player.name = npc.name
    player.anim = `${npc.avatar}_idle_down`
    player.x = npc.spawnX
    player.y = npc.spawnY
    player.isNpc = true
    player.readyToConnect = false
    player.videoConnected = false

    // Use npcId as the key so we can find it later
    const key = `npc_${npc.id}`
    this.room.state.players.set(key, player)
    npcPlayerKeys.set(npc.id, key)

    console.log(`[NPC Engine] Spawned NPC: ${npc.name} at (${npc.spawnX}, ${npc.spawnY})`)
  }

  despawnNpc(npcId: string): void {
    if (!this.room) return
    const key = npcPlayerKeys.get(npcId)
    if (key) {
      this.room.state.players.delete(key)
      npcPlayerKeys.delete(npcId)
      clearWanderState(npcId)
    }
  }

  private behaviorTick(): void {
    if (!this.room) return

    for (const npc of this.loadedNpcs) {
      const key = npcPlayerKeys.get(npc.id)
      if (!key) continue
      const player = this.room.state.players.get(key)
      if (!player) continue

      switch (npc.behavior) {
        case 'stay_at_desk':
          stay_at_desk(player)
          break
        case 'wander_room':
          wander_room(player, npc.id, this.mapBounds)
          break
        case 'wander_freely':
          wander_freely(player, npc.id, this.mapBounds)
          break
        default:
          stay_at_desk(player)
      }
    }
  }

  private async heartbeat(): Promise<void> {
    if (!this.room) return

    // Re-spawn any NPCs that lost their state
    for (const npc of this.loadedNpcs) {
      const key = npcPlayerKeys.get(npc.id)
      if (!key || !this.room.state.players.has(key)) {
        console.log(`[NPC Engine] Heartbeat: re-spawning missing NPC ${npc.name}`)
        this.spawnNpc(npc)
      }
    }
  }

  async handleNpcMessage(
    npcId: string,
    userId: string,
    message: string
  ): Promise<string> {
    const sessionId = `${npcId}:${userId}`

    // Face NPC toward the user if we can find user position
    this.faceNpcTowardUser(npcId, userId)

    const response = await handleMessage(sessionId, message)
    return response
  }

  async startNpcConversation(
    npcId: string,
    userId: string
  ): Promise<{ sessionId: string; greeting: string }> {
    this.faceNpcTowardUser(npcId, userId)
    return startConversation(npcId, userId)
  }

  async stopNpcConversation(npcId: string, userId: string): Promise<void> {
    const sessionId = `${npcId}:${userId}`
    await endConversation(sessionId)
  }

  private faceNpcTowardUser(npcId: string, userId: string): void {
    if (!this.room) return

    const npcKey = npcPlayerKeys.get(npcId)
    if (!npcKey) return
    const npcPlayer = this.room.state.players.get(npcKey)
    if (!npcPlayer) return

    // Find the user player (by iterating players; userId is DB id, sessionId may differ)
    // The session ID for human players is the Colyseus sessionId, not userId.
    // We look for a player whose key matches any client with that auth userId.
    // As a fallback we just face them toward default direction.
    this.room.clients.forEach((client) => {
      const auth = client.auth as { id?: string } | null
      if (auth?.id === userId) {
        const userPlayer = this.room!.state.players.get(client.sessionId)
        if (userPlayer) {
          face_user(npcPlayer, userPlayer.x, userPlayer.y)
        }
      }
    })
  }

  async handleMention(
    npcId: string,
    roomId: string,
    message: string,
    participants: string[],
    userId: string
  ): Promise<string> {
    // Move NPC toward meeting room centre (use room centre heuristic from state zones)
    if (this.room) {
      const zone = this.room.state.zones.get(roomId)
      if (zone) {
        const key = npcPlayerKeys.get(npcId)
        if (key) {
          const npcPlayer = this.room.state.players.get(key)
          if (npcPlayer) {
            go_to_meeting(npcPlayer, zone.x + zone.w / 2, zone.y + zone.h / 2)
          }
        }
      }
    }

    // Route through conversation manager with meeting context
    const sessionId = `${npcId}:${userId}`
    const participantList = participants.join(', ')
    const contextualMessage = `[Meeting in room ${roomId}, participants: ${participantList}] ${message}`

    // Ensure session exists
    if (!this.room) return "I'm not available right now."
    try {
      await startConversation(npcId, userId)
    } catch {
      // Session may already exist — that's fine
    }

    return handleMessage(sessionId, contextualMessage)
  }

  setMapBounds(bounds: Bounds): void {
    this.mapBounds = bounds
  }

  dispose(): void {
    if (this.behaviorTimer) clearInterval(this.behaviorTimer)
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    this.room = null
  }
}

export { NPCEngine }
