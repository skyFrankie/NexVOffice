import Phaser from 'phaser'

export const phaserEvents = new Phaser.Events.EventEmitter()

export enum Event {
  PLAYER_JOINED = 'player-joined',
  PLAYER_UPDATED = 'player-updated',
  PLAYER_LEFT = 'player-left',
  PLAYER_DISCONNECTED = 'player-disconnected',
  MY_PLAYER_READY = 'my-player-ready',
  MY_PLAYER_NAME_CHANGE = 'my-player-name-change',
  MY_PLAYER_TEXTURE_CHANGE = 'my-player-texture-change',
  MY_PLAYER_VIDEO_CONNECTED = 'my-player-video-connected',
  ITEM_USER_ADDED = 'item-user-added',
  ITEM_USER_REMOVED = 'item-user-removed',
  UPDATE_DIALOG_BUBBLE = 'update-dialog-bubble',

  // keyboard control
  DISABLE_KEYS = 'disable-keys',
  ENABLE_KEYS = 'enable-keys',

  // zone
  ENTER_ZONE = 'enter-zone',
  LEAVE_ZONE = 'leave-zone',

  // NPC
  NPC_INTERACTION_START = 'npc-interaction-start',
  NPC_INTERACTION_END = 'npc-interaction-end',
  NPC_RESPONSE = 'npc-response',

  // proximity chat
  PROXIMITY_CHAT_START = 'proximity-chat-start',

  // gamification
  PLAYER_BEAT = 'player-beat',
  HP_UPDATE = 'hp-update',
}
