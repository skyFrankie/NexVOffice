import type { Config } from 'drizzle-kit'

export default {
  schema: './server/db/schema.ts',
  out: './server/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://nexvoffice:nexvoffice_dev@localhost:5432/nexvoffice',
  },
} satisfies Config
