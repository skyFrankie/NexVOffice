import Peer from 'peerjs'
import store from '../stores'
import { setMyStream, addVideoStream, removeVideoStream } from '../stores/ComputerStore'
import { sanitizeId } from '../util'
import { getIceConfig } from './iceConfig'

export default class ShareScreenManager {
  myStream?: MediaStream
  private myPeer: Peer | null = null
  private calledPeers = new Map<string, Peer.MediaConnection>()
  private onCalledPeers = new Map<string, Peer.MediaConnection>()

  constructor(userId: string) {
    const peerId = sanitizeId(userId) + '-ss'

    getIceConfig().then((iceConfig) => {
      this.myPeer = new Peer(peerId, {
        host: window.location.hostname,
        port: window.location.port
          ? parseInt(window.location.port)
          : window.location.protocol === 'https:'
          ? 443
          : 80,
        path: '/peerjs',
        secure: window.location.protocol === 'https:',
        config: iceConfig,
      })

      this.myPeer.on('error', (err) => {
        console.error('ShareScreenManager PeerJS error:', err.type, err)
      })
    })
  }

  onOpen() {
    if (!this.myPeer) return
    this.myPeer.on('call', (call) => {
      call.answer()
      const peerId = call.peer

      call.on('stream', (remoteStream) => {
        store.dispatch(addVideoStream({ id: peerId, call, stream: remoteStream }))
        this.onCalledPeers.set(peerId, call)
      })

      call.on('close', () => {
        store.dispatch(removeVideoStream(peerId))
        this.onCalledPeers.delete(peerId)
      })

      call.on('error', () => {
        store.dispatch(removeVideoStream(peerId))
        this.onCalledPeers.delete(peerId)
      })
    })
  }

  onClose() {
    for (const call of this.calledPeers.values()) {
      call.close()
    }
    for (const call of this.onCalledPeers.values()) {
      call.close()
    }
    this.calledPeers.clear()
    this.onCalledPeers.clear()
    if (this.myPeer) this.myPeer.destroy()
  }

  async startScreenShare() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
      this.myStream = stream
      store.dispatch(setMyStream(stream))

      stream.getVideoTracks()[0].addEventListener('ended', () => {
        this.stopScreenShare()
      })

      for (const [peerId] of this.calledPeers) {
        if (!this.myPeer) continue
        const call = this.myPeer.call(peerId, stream)
        if (!call) continue
        this.setupOutgoingCall(call, peerId)
      }
    } catch (err) {
      console.error('ShareScreenManager: failed to get display media', err)
    }
  }

  stopScreenShare(shouldDispatch = true) {
    if (this.myStream) {
      this.myStream.getTracks().forEach((t) => t.stop())
      this.myStream = undefined
    }

    for (const call of this.calledPeers.values()) {
      call.close()
    }
    this.calledPeers.clear()

    if (shouldDispatch) {
      store.dispatch(setMyStream(null))
    }
  }

  onUserJoined(userId: string) {
    if (!this.myStream) return

    const peerId = sanitizeId(userId) + '-ss'
    if (this.calledPeers.has(peerId)) return

    if (!this.myPeer) return
    const call = this.myPeer.call(peerId, this.myStream)
    if (!call) return

    this.setupOutgoingCall(call, peerId)
  }

  onUserLeft(userId: string) {
    const peerId = sanitizeId(userId) + '-ss'

    if (this.calledPeers.has(peerId)) {
      this.calledPeers.get(peerId)!.close()
      this.calledPeers.delete(peerId)
    }

    store.dispatch(removeVideoStream(peerId))
  }

  private setupOutgoingCall(call: Peer.MediaConnection, peerId: string) {
    this.calledPeers.set(peerId, call)

    call.on('close', () => {
      this.calledPeers.delete(peerId)
      store.dispatch(removeVideoStream(peerId))
    })

    call.on('error', () => {
      this.calledPeers.delete(peerId)
      store.dispatch(removeVideoStream(peerId))
    })
  }
}
