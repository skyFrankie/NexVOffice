import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import { db } from '../db/connection'
import { users } from '../db/schema'
import { eq } from 'drizzle-orm'
import { config } from '../config'

export interface AuthPayload {
  id: string
  username: string
  displayName: string
  avatar: string
  role: 'admin' | 'member'
  mustChangePassword: boolean
}

export const authService = {
  async login(username: string, password: string): Promise<{ token: string; user: AuthPayload } | null> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1)
    const user = result[0]
    if (!user || !user.isActive) return null

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) return null

    const payload: AuthPayload = {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    }

    const token = jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn as any })
    return { token, user: payload }
  },

  async verifyToken(token: string): Promise<AuthPayload | null> {
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as AuthPayload
      // Verify user still exists and is active
      const result = await db.select().from(users).where(eq(users.id, decoded.id)).limit(1)
      const user = result[0]
      if (!user || !user.isActive) return null
      return {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      }
    } catch {
      return null
    }
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<boolean> {
    const result = await db.select().from(users).where(eq(users.id, userId)).limit(1)
    const user = result[0]
    if (!user) return false

    const valid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!valid) return false

    const hash = await bcrypt.hash(newPassword, config.bcryptRounds)
    await db.update(users).set({
      passwordHash: hash,
      mustChangePassword: false,
      updatedAt: new Date(),
    }).where(eq(users.id, userId))

    return true
  },
}
