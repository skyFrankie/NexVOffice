import Network from './Network'

export type ConnectionState = 'connected' | 'reconnecting' | 'disconnected'

type ConnectionStateListener = (state: ConnectionState, attempt?: number) => void

const RECONNECT_BASE_MS = 1000
const RECONNECT_MAX_MS = 30000
const RECONNECT_MAX_ATTEMPTS = 5

class NetworkService {
  private network: Network | null = null
  private connectionState: ConnectionState = 'connected'
  private reconnectAttempt = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectFactory: (() => Promise<void>) | null = null
  private stateListeners: ConnectionStateListener[] = []

  setNetwork(network: Network) {
    this.network = network
  }

  getNetwork(): Network {
    if (!this.network) throw new Error('NetworkService not initialized. Call setNetwork() first.')
    return this.network
  }

  private assertInitialized(): Network {
    if (!this.network) throw new Error('NetworkService not initialized. Call setNetwork() first.')
    return this.network
  }

  // Register a listener for connection state changes (returns unsubscribe fn)
  onConnectionStateChange(listener: ConnectionStateListener): () => void {
    this.stateListeners.push(listener)
    return () => {
      this.stateListeners = this.stateListeners.filter((l) => l !== listener)
    }
  }

  private emitState(state: ConnectionState, attempt?: number) {
    this.connectionState = state
    this.stateListeners.forEach((l) => l(state, attempt))
  }

  getConnectionState(): ConnectionState {
    return this.connectionState
  }

  // Call this to register the function that creates a new connection (e.g. joinOrCreatePublic)
  // Reconnection will call it automatically with exponential backoff
  enableReconnection(factory: () => Promise<void>) {
    this.reconnectFactory = factory
  }

  // Call this when a disconnect is detected (e.g. from room.onLeave)
  handleDisconnect() {
    if (this.connectionState === 'reconnecting') return
    this.reconnectAttempt = 0
    this.scheduleReconnect()
  }

  private scheduleReconnect() {
    if (!this.reconnectFactory) return
    if (this.reconnectAttempt >= RECONNECT_MAX_ATTEMPTS) {
      this.emitState('disconnected')
      return
    }

    const delay = Math.min(RECONNECT_BASE_MS * Math.pow(2, this.reconnectAttempt), RECONNECT_MAX_MS)
    this.reconnectAttempt++
    this.emitState('reconnecting', this.reconnectAttempt)

    this.reconnectTimer = setTimeout(async () => {
      if (!this.reconnectFactory) return
      try {
        await this.reconnectFactory()
        this.reconnectAttempt = 0
        this.emitState('connected')
      } catch {
        this.scheduleReconnect()
      }
    }, delay)
  }

  cancelReconnection() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.reconnectAttempt = 0
    this.emitState('connected')
  }

  // Typed convenience methods wrapping Network
  sendChatMessage(content: string) {
    this.assertInitialized().addChatMessage(content)
  }

  connectToComputer(id: string) {
    this.assertInitialized().connectToComputer(id)
  }

  disconnectFromComputer(id: string) {
    this.assertInitialized().disconnectFromComputer(id)
  }

  connectToWhiteboard(id: string) {
    this.assertInitialized().connectToWhiteboard(id)
  }

  disconnectFromWhiteboard(id: string) {
    this.assertInitialized().disconnectFromWhiteboard(id)
  }

  onStopScreenShare(id: string) {
    this.assertInitialized().onStopScreenShare(id)
  }

  updatePlayer(x: number, y: number, anim: string) {
    this.assertInitialized().updatePlayer(x, y, anim)
  }

  updatePlayerName(name: string) {
    this.assertInitialized().updatePlayerName(name)
  }

  readyToConnect() {
    this.assertInitialized().readyToConnect()
  }

  videoConnected() {
    this.assertInitialized().videoConnected()
  }

  playerStreamDisconnect(id: string) {
    this.assertInitialized().playerStreamDisconnect(id)
  }

  sendDm(targetSessionId: string, content: string) {
    this.assertInitialized().sendDm(targetSessionId, content)
  }

  sendRoomMessage(content: string) {
    this.assertInitialized().sendRoomMessage(content)
  }
}

export const networkService = new NetworkService()
export default networkService
