import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { IChatMessage } from '../../../types/IOfficeState'

export enum MessageType {
  PLAYER_JOINED,
  PLAYER_LEFT,
  REGULAR_MESSAGE,
}

export interface ChatMessageEntry {
  messageType: MessageType
  chatMessage: IChatMessage
}

export interface DmChannel {
  channelId: string | null  // DB channel ID, null until loaded
  partnerId: string         // session ID of the other player
  partnerName: string
  messages: ChatMessageEntry[]
  unread: number
}

interface ChatState {
  activeTab: 'public' | 'room' | 'dm'
  // Public chat
  publicMessages: ChatMessageEntry[]
  // Room chat
  roomMessages: ChatMessageEntry[]
  currentRoomId: string | null
  currentRoomName: string | null
  // DMs
  dmChannels: Record<string, DmChannel>  // keyed by partnerId (sessionId)
  activeDmPartnerId: string | null
  // UI state
  focused: boolean
  showChat: boolean
}

const initialState: ChatState = {
  activeTab: 'public',
  publicMessages: [],
  roomMessages: [],
  currentRoomId: null,
  currentRoomName: null,
  dmChannels: {},
  activeDmPartnerId: null,
  focused: false,
  showChat: true,
}

export const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setActiveTab: (state, action: PayloadAction<'public' | 'room' | 'dm'>) => {
      state.activeTab = action.payload
    },
    // Public messages
    pushPublicMessage: (state, action: PayloadAction<IChatMessage>) => {
      state.publicMessages.push({
        messageType: MessageType.REGULAR_MESSAGE,
        chatMessage: action.payload,
      })
    },
    pushPlayerJoinedMessage: (state, action: PayloadAction<string>) => {
      state.publicMessages.push({
        messageType: MessageType.PLAYER_JOINED,
        chatMessage: {
          createdAt: new Date().getTime(),
          author: action.payload,
          content: 'joined the office',
        } as IChatMessage,
      })
    },
    pushPlayerLeftMessage: (state, action: PayloadAction<string>) => {
      state.publicMessages.push({
        messageType: MessageType.PLAYER_LEFT,
        chatMessage: {
          createdAt: new Date().getTime(),
          author: action.payload,
          content: 'left the office',
        } as IChatMessage,
      })
    },
    // Room messages
    pushRoomMessage: (state, action: PayloadAction<IChatMessage>) => {
      state.roomMessages.push({
        messageType: MessageType.REGULAR_MESSAGE,
        chatMessage: action.payload,
      })
    },
    setCurrentRoom: (state, action: PayloadAction<{ roomId: string | null, roomName: string | null }>) => {
      state.currentRoomId = action.payload.roomId
      state.currentRoomName = action.payload.roomName
      // Clear room messages when changing rooms
      state.roomMessages = []
    },
    clearRoomChat: (state) => {
      state.roomMessages = []
      state.currentRoomId = null
      state.currentRoomName = null
    },
    // DM messages
    pushDmMessage: (state, action: PayloadAction<{ partnerId: string, partnerName: string, message: IChatMessage }>) => {
      const { partnerId, partnerName, message } = action.payload
      if (!state.dmChannels[partnerId]) {
        state.dmChannels[partnerId] = {
          channelId: null,
          partnerId,
          partnerName,
          messages: [],
          unread: 0,
        }
      }
      state.dmChannels[partnerId].messages.push({
        messageType: MessageType.REGULAR_MESSAGE,
        chatMessage: message,
      })
      // Increment unread if not viewing this DM
      if (state.activeDmPartnerId !== partnerId || state.activeTab !== 'dm') {
        state.dmChannels[partnerId].unread++
      }
    },
    setActiveDmPartner: (state, action: PayloadAction<string | null>) => {
      state.activeDmPartnerId = action.payload
      // Clear unread for this partner
      if (action.payload && state.dmChannels[action.payload]) {
        state.dmChannels[action.payload].unread = 0
      }
    },
    openDmWithPlayer: (state, action: PayloadAction<{ partnerId: string, partnerName: string }>) => {
      const { partnerId, partnerName } = action.payload
      if (!state.dmChannels[partnerId]) {
        state.dmChannels[partnerId] = {
          channelId: null,
          partnerId,
          partnerName,
          messages: [],
          unread: 0,
        }
      }
      state.activeDmPartnerId = partnerId
      state.activeTab = 'dm'
      state.showChat = true
      state.dmChannels[partnerId].unread = 0
    },
    // UI state
    setFocused: (state, action: PayloadAction<boolean>) => {
      state.focused = action.payload
    },
    setShowChat: (state, action: PayloadAction<boolean>) => {
      state.showChat = action.payload
    },
  },
})

export const {
  setActiveTab,
  pushPublicMessage,
  pushPlayerJoinedMessage,
  pushPlayerLeftMessage,
  pushRoomMessage,
  setCurrentRoom,
  clearRoomChat,
  pushDmMessage,
  setActiveDmPartner,
  openDmWithPlayer,
  setFocused,
  setShowChat,
} = chatSlice.actions

export default chatSlice.reducer
