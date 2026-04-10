import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { db } from './connection'

export async function runMigrations() {
  console.log('Running database migrations...')
  await migrate(db, { migrationsFolder: './server/db/migrations' })
  console.log('Migrations complete.')
}
