import { db } from '../db/connection'
import { playerStats } from '../db/schema'
import { sql } from 'drizzle-orm'
import { Room } from 'colyseus'
import { IOfficeState } from '../../types/IOfficeState'
import { Message } from '../../types/Messages'

function msUntilMidnightUTC(): number {
  const now = new Date()
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
  return midnight.getTime() - now.getTime()
}

async function resetAllHp(activeRooms: Room<IOfficeState>[]): Promise<void> {
  // Reset HP in database: set hp = max_hp for all players
  await db.execute(sql`UPDATE player_stats SET hp = max_hp, updated_at = NOW()`)

  // Reset HP in all active room states and broadcast HP_UPDATE
  for (const room of activeRooms) {
    room.state.players.forEach((player, sessionId) => {
      if (!player.isNpc) {
        player.hp = player.maxHp
        room.broadcast(Message.HP_UPDATE, {
          userId: sessionId,
          hp: player.hp,
          maxHp: player.maxHp,
        })
      }
    })
  }

  console.log(`[hp-reset] Reset HP for all players at ${new Date().toISOString()}`)
}

export function startHpResetCron(getRooms: () => Room<IOfficeState>[]): void {
  const scheduleNext = () => {
    const delay = msUntilMidnightUTC()
    setTimeout(async () => {
      try {
        await resetAllHp(getRooms())
      } catch (err) {
        console.error('[hp-reset] Failed to reset HP:', err)
      }
      scheduleNext()
    }, delay)
  }

  scheduleNext()
  console.log(`[hp-reset] Cron scheduled; next reset in ${Math.round(msUntilMidnightUTC() / 1000 / 60)} minutes`)
}
