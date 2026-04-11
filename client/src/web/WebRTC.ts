import Peer from 'peerjs'
import Network from '../services/Network'
import store from '../stores'
import { setVideoConnected } from '../stores/UserStore'
import { setMyStream, addVideoStream, removeVideoStream } from '../stores/ComputerStore'
import { sanitizeId } from '../util'
import { getIceConfig } from './iceConfig'

export default class WebRTC {
  private myPeer: Peer | null = null
  private peers = new Map<string, Peer.MediaConnection>()
  private onCalledPeers = new Map<string, Peer.MediaConnection>()
  private videoGrid = document.getElementById('video-grid')
  private myStream?: MediaStream
  private network: Network

  constructor(userId: string, network: Network) {
    this.network = network
    const sanitizedId = sanitizeId(userId)

    getIceConfig().then((iceConfig) => {
      this.myPeer = new Peer(sanitizedId, {
        host: window.location.hostname,
        port: window.location.port ? parseInt(window.location.port) : (window.location.protocol === 'https:' ? 443 : 80),
        path: '/peerjs',
        secure: window.location.protocol === 'https:',
        config: iceConfig,
      })

      this.myPeer.on('error', (err) => {
        console.error('PeerJS error:', err.type, err)
      })

      this.myPeer.on('call', (call) => {
        if (!this.myStream) {
          // If we don't have a stream yet, try to get one
          this.getUserMedia(false).then(() => {
            call.answer(this.myStream)
            this.setupCallListeners(call, true)
          }).catch(() => {
            call.answer() // answer without stream
            this.setupCallListeners(call, true)
          })
        } else {
          call.answer(this.myStream)
          this.setupCallListeners(call, true)
        }
      })
    })
  }

  checkPreviousPermission() {
    // Check if user previously granted media permission
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'camera' as PermissionName }).then((result) => {
        if (result.state === 'granted') {
          this.getUserMedia(false)
        }
      }).catch(() => {
        // permissions API not supported for camera, skip
      })
    }
  }

  async getUserMedia(alertOnError = true) {
    try {
      this.myStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      })
      store.dispatch(setMyStream(this.myStream))
      store.dispatch(setVideoConnected(true))
      this.network.videoConnected()
    } catch (err) {
      if (alertOnError) {
        console.warn('Failed to get user media:', err)
      }
    }
  }

  connectToNewUser(userId: string) {
    if (!this.myPeer) return
    const sanitizedUserId = sanitizeId(userId)
    if (this.peers.has(sanitizedUserId)) return

    const call = this.myPeer.call(sanitizedUserId, this.myStream || new MediaStream())
    if (!call) return

    this.setupCallListeners(call, false)
  }

  private setupCallListeners(call: Peer.MediaConnection, isIncoming: boolean) {
    const peerId = call.peer
    const peerMap = isIncoming ? this.onCalledPeers : this.peers

    call.on('stream', (remoteStream) => {
      store.dispatch(addVideoStream({ id: peerId, call, stream: remoteStream }))
    })

    call.on('close', () => {
      store.dispatch(removeVideoStream(peerId))
      peerMap.delete(peerId)
    })

    call.on('error', (err) => {
      console.error('Call error:', err)
      store.dispatch(removeVideoStream(peerId))
      peerMap.delete(peerId)
    })

    peerMap.set(peerId, call)
  }

  deleteVideoStream(userId: string) {
    const sanitizedUserId = sanitizeId(userId)
    if (this.peers.has(sanitizedUserId)) {
      this.peers.get(sanitizedUserId)!.close()
      this.peers.delete(sanitizedUserId)
    }
    store.dispatch(removeVideoStream(sanitizedUserId))
  }

  deleteOnCalledVideoStream(userId: string) {
    const sanitizedUserId = sanitizeId(userId)
    if (this.onCalledPeers.has(sanitizedUserId)) {
      this.onCalledPeers.get(sanitizedUserId)!.close()
      this.onCalledPeers.delete(sanitizedUserId)
    }
    store.dispatch(removeVideoStream(sanitizedUserId))
  }
}
