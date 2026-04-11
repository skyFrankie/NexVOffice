import { Schema, ArraySchema, SetSchema, MapSchema } from '@colyseus/schema'

export interface IPlayer extends Schema {
  name: string
  x: number
  y: number
  anim: string
  readyToConnect: boolean
  videoConnected: boolean
  currentZone: string
  hp: number
  maxHp: number
  lastBeatAt: number
  isNpc: boolean
}

export interface IRoomZone extends Schema {
  roomId: string
  roomName: string
  x: number
  y: number
  w: number
  h: number
  voice: boolean
  screenshare: boolean
  whiteboard: boolean
  privateChat: boolean
}

export interface IComputer extends Schema {
  connectedUser: SetSchema<string>
}

export interface IWhiteboard extends Schema {
  roomId: string
  connectedUser: SetSchema<string>
}

export interface IChatMessage extends Schema {
  author: string
  createdAt: number
  content: string
}

export interface IOfficeState extends Schema {
  players: MapSchema<IPlayer>
  computers: MapSchema<IComputer>
  whiteboards: MapSchema<IWhiteboard>
  chatMessages: ArraySchema<IChatMessage>
  zones: MapSchema<IRoomZone>
  spawnX: number
  spawnY: number
}
