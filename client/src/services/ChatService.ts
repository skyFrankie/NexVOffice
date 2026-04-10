import networkService from './NetworkService'
import store from '../stores'
import { phaserEvents, Event } from '../events/EventCenter'

class ChatService {
  sendPublicMessage(content: string) {
    networkService.sendChatMessage(content)
    phaserEvents.emit(Event.UPDATE_DIALOG_BUBBLE, store.getState().user.sessionId, content)
  }
}

export const chatService = new ChatService()
export default chatService
