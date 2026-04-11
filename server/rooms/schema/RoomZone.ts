import { Schema, type } from '@colyseus/schema'

export class RoomZoneState extends Schema {
  @type('string') roomId = ''
  @type('string') roomName = ''
  @type('number') x = 0
  @type('number') y = 0
  @type('number') w = 0
  @type('number') h = 0
  @type('boolean') voice = false
  @type('boolean') screenshare = false
  @type('boolean') whiteboard = false
  @type('boolean') privateChat = false
}
