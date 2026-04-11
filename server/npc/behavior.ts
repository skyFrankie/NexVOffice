import { Player } from '../rooms/schema/OfficeState'

export interface Bounds {
  x: number
  y: number
  w: number
  h: number
}

interface WanderState {
  targetX: number
  targetY: number
  ticksUntilNewTarget: number
}

const wanderStates = new Map<string, WanderState>()

const MOVE_SPEED = 4 // pixels per tick
const WANDER_TICK_MIN = 20
const WANDER_TICK_MAX = 80

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function animDir(dx: number, dy: number, avatar: string): string {
  const base = avatar.split('_')[0] || 'adam'
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? `${base}_walk_right` : `${base}_walk_left`
  }
  return dy > 0 ? `${base}_walk_down` : `${base}_walk_up`
}

function idleDir(avatar: string): string {
  const base = avatar.split('_')[0] || 'adam'
  return `${base}_idle_down`
}

function extractAvatar(anim: string): string {
  return anim.split('_')[0] || 'adam'
}

export function stay_at_desk(npc: Player): void {
  const avatar = extractAvatar(npc.anim)
  npc.anim = idleDir(avatar)
}

function wanderStep(npcId: string, npc: Player, bounds: Bounds): void {
  let state = wanderStates.get(npcId)

  if (!state || state.ticksUntilNewTarget <= 0) {
    state = {
      targetX: randomInt(bounds.x, bounds.x + bounds.w),
      targetY: randomInt(bounds.y, bounds.y + bounds.h),
      ticksUntilNewTarget: randomInt(WANDER_TICK_MIN, WANDER_TICK_MAX),
    }
    wanderStates.set(npcId, state)
  }

  state.ticksUntilNewTarget--

  const dx = state.targetX - npc.x
  const dy = state.targetY - npc.y
  const dist = Math.sqrt(dx * dx + dy * dy)

  if (dist < MOVE_SPEED) {
    npc.x = state.targetX
    npc.y = state.targetY
    state.ticksUntilNewTarget = 0
    npc.anim = idleDir(extractAvatar(npc.anim))
  } else {
    npc.x += Math.round((dx / dist) * MOVE_SPEED)
    npc.y += Math.round((dy / dist) * MOVE_SPEED)
    npc.anim = animDir(dx, dy, extractAvatar(npc.anim))
  }
}

export function wander_room(npc: Player, npcId: string, zoneBounds: Bounds): void {
  wanderStep(npcId, npc, zoneBounds)
}

export function wander_freely(npc: Player, npcId: string, mapBounds: Bounds): void {
  wanderStep(npcId, npc, mapBounds)
}

export function go_to_meeting(npc: Player, targetX: number, targetY: number): boolean {
  const dx = targetX - npc.x
  const dy = targetY - npc.y
  const dist = Math.sqrt(dx * dx + dy * dy)

  if (dist < MOVE_SPEED) {
    npc.x = targetX
    npc.y = targetY
    npc.anim = idleDir(extractAvatar(npc.anim))
    return true // arrived
  }

  npc.x += Math.round((dx / dist) * MOVE_SPEED)
  npc.y += Math.round((dy / dist) * MOVE_SPEED)
  npc.anim = animDir(dx, dy, extractAvatar(npc.anim))
  return false
}

export function face_user(npc: Player, userX: number, userY: number): void {
  const avatar = extractAvatar(npc.anim)
  const dx = userX - npc.x
  const dy = userY - npc.y

  if (Math.abs(dx) > Math.abs(dy)) {
    npc.anim = dx > 0 ? `${avatar}_idle_right` : `${avatar}_idle_left`
  } else {
    npc.anim = dy > 0 ? `${avatar}_idle_down` : `${avatar}_idle_up`
  }
}

export function clearWanderState(npcId: string): void {
  wanderStates.delete(npcId)
}
