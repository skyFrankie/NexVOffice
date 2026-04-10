import { db } from './connection'
import { users } from './schema'
import { eq, count } from 'drizzle-orm'
import bcrypt from 'bcrypt'
import { config } from '../config'

export async function seedAdmin() {
  const result = await db.select({ value: count() }).from(users)
  if (result[0].value > 0) {
    console.log('Users exist, skipping seed.')
    return
  }

  const hash = await bcrypt.hash('changeme', config.bcryptRounds)
  await db.insert(users).values({
    username: 'admin',
    passwordHash: hash,
    displayName: 'Admin',
    avatar: 'adam',
    role: 'admin',
    mustChangePassword: true,
  })
  console.log('Admin account seeded (username: admin, password: changeme)')
}
