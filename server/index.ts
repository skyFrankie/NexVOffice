import 'express-async-errors'
import http from 'http'
import express from 'express'
import cors from 'cors'
import { Server, LobbyRoom } from 'colyseus'
import { monitor } from '@colyseus/monitor'
import { RoomType } from '../types/Rooms'

// import socialRoutes from "@colyseus/social/express"

import { SkyOffice } from './rooms/SkyOffice'
import { runMigrations } from './db/migrate'
import { seedAdmin, seedDefaultLayout } from './db/seed'
import authRoutes from './auth/routes'
import userRoutes from './api/users'
import mapRoutes from './api/map'
import adminRoutes from './api/admin'
import chatRoutes from './api/chat'
import npcRoutes from './api/npc'
import taskRoutes from './api/tasks'
import { authMiddleware, adminOnly } from './auth/middleware'
import { startHpResetCron } from './gamification/hp-reset'
import { activeRooms } from './rooms/registry'

const port = Number(process.env.PORT || 2567)
const app = express()

app.use(cors())
app.use(express.json())
app.use(express.static('client/dist'))

// PeerJS proxy — forward /peerjs requests to the peerjs container
import { createProxyMiddleware } from 'http-proxy-middleware'
app.use('/peerjs', createProxyMiddleware({
  target: 'http://peerjs:9000',
  changeOrigin: true,
  ws: true,
}))

// TURN credentials endpoint for WebRTC clients (authenticated)
app.get('/api/turn-credentials', authMiddleware, (_req, res) => {
  res.json({
    username: process.env.TURN_USERNAME || 'nexvoffice',
    credential: process.env.TURN_PASSWORD || 'nexvoffice_dev',
  })
})

const server = http.createServer(app)
const gameServer = new Server({
  server,
})

// register room handlers
gameServer.define(RoomType.LOBBY, LobbyRoom)
gameServer.define(RoomType.PUBLIC, SkyOffice, {
  name: 'Public Lobby',
  description: 'For making friends and familiarizing yourself with the controls',
  password: null,
  autoDispose: false,
})
gameServer.define(RoomType.CUSTOM, SkyOffice).enableRealtimeListing()

/**
 * Register @colyseus/social routes
 *
 * - uncomment if you want to use default authentication (https://docs.colyseus.io/server/authentication/)
 * - also uncomment the import statement
 */
// app.use("/", socialRoutes);

app.use('/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/map', mapRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/npcs', npcRoutes)
app.use('/api/tasks', taskRoutes)

// register colyseus monitor AFTER registering your room handlers
app.use('/colyseus', authMiddleware, adminOnly, monitor())

async function start() {
  await runMigrations()
  await seedAdmin()
  await seedDefaultLayout()
  gameServer.listen(port)
  console.log(`Listening on ws://localhost:${port}`)

  // Start daily HP reset cron — activeRooms is populated by SkyOffice onCreate/onDispose
  startHpResetCron(() => activeRooms)
}
start().catch((err) => { console.error('Startup failed:', err); process.exit(1) })
