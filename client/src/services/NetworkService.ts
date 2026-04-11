import Network from './Network'

class NetworkService {
  private network: Network | null = null

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
