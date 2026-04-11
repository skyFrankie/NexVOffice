import Peer from 'peerjs'
import { sanitizeId } from '../util'
import { getIceConfig } from '../web/iceConfig'

export interface VoiceMember {
  peerId: string
  stream: MediaStream
  call: Peer.MediaConnection
}

type VoiceEventHandler = () => void
type MemberEventHandler = (peerId: string, stream: MediaStream) => void

class VoiceService {
  private peer: Peer | null = null
  private localStream: MediaStream | null = null
  private members = new Map<string, VoiceMember>()
  private currentRoomId: string | null = null
  private micEnabled = false
  private cameraEnabled = false

  // Event callbacks
  private onMemberJoinedCallbacks: MemberEventHandler[] = []
  private onMemberLeftCallbacks: ((peerId: string) => void)[] = []
  private onStateChangeCallbacks: VoiceEventHandler[] = []

  get isMicOn() { return this.micEnabled }
  get isCameraOn() { return this.cameraEnabled }
  get isInRoom() { return this.currentRoomId !== null }
  get roomId() { return this.currentRoomId }
  get memberList() { return new Map(this.members) }
  get stream() { return this.localStream }

  async joinRoom(roomId: string, mySessionId: string) {
    if (this.currentRoomId === roomId) return
    if (this.currentRoomId) this.leaveRoom()

    this.currentRoomId = roomId
    const peerId = sanitizeId(mySessionId) + '-voice-' + sanitizeId(roomId)

    const iceConfig = await getIceConfig()
    this.peer = new Peer(peerId, {
      host: window.location.hostname,
      port: window.location.port ? parseInt(window.location.port) : (window.location.protocol === 'https:' ? 443 : 80),
      path: '/peerjs',
      secure: window.location.protocol === 'https:',
      config: iceConfig,
    })

    this.peer.on('error', (err) => {
      console.error('VoiceService PeerJS error:', err.type, err)
    })

    // Handle incoming calls from other room members
    this.peer.on('call', (call) => {
      call.answer(this.localStream || undefined)
      this.handleIncomingCall(call)
    })

    // Get mic stream, muted by default
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      // Start muted
      this.localStream.getAudioTracks().forEach((t) => { t.enabled = false })
      this.micEnabled = false
    } catch {
      this.localStream = null
    }

    this.notifyStateChange()
  }

  leaveRoom() {
    // Close all peer connections
    for (const [id, member] of this.members) {
      member.call.close()
      this.onMemberLeftCallbacks.forEach((cb) => cb(id))
    }
    this.members.clear()

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop())
      this.localStream = null
    }

    // Destroy peer
    if (this.peer) {
      this.peer.destroy()
      this.peer = null
    }

    this.currentRoomId = null
    this.micEnabled = false
    this.cameraEnabled = false
    this.notifyStateChange()
  }

  connectToPeer(targetSessionId: string) {
    if (!this.peer || !this.currentRoomId) return
    const targetPeerId = sanitizeId(targetSessionId) + '-voice-' + sanitizeId(this.currentRoomId)

    if (this.members.has(targetPeerId)) return

    const call = this.peer.call(targetPeerId, this.localStream || new MediaStream())
    if (!call) return

    call.on('stream', (remoteStream) => {
      if (!this.members.has(targetPeerId)) {
        this.members.set(targetPeerId, { peerId: targetPeerId, stream: remoteStream, call })
        this.onMemberJoinedCallbacks.forEach((cb) => cb(targetPeerId, remoteStream))
        this.notifyStateChange()
      }
    })

    call.on('close', () => {
      this.members.delete(targetPeerId)
      this.onMemberLeftCallbacks.forEach((cb) => cb(targetPeerId))
      this.notifyStateChange()
    })

    call.on('error', () => {
      this.members.delete(targetPeerId)
      this.onMemberLeftCallbacks.forEach((cb) => cb(targetPeerId))
      this.notifyStateChange()
    })
  }

  private handleIncomingCall(call: Peer.MediaConnection) {
    const peerId = call.peer

    call.on('stream', (remoteStream) => {
      if (!this.members.has(peerId)) {
        this.members.set(peerId, { peerId, stream: remoteStream, call })
        this.onMemberJoinedCallbacks.forEach((cb) => cb(peerId, remoteStream))
        this.notifyStateChange()
      }
    })

    call.on('close', () => {
      this.members.delete(peerId)
      this.onMemberLeftCallbacks.forEach((cb) => cb(peerId))
      this.notifyStateChange()
    })

    call.on('error', () => {
      this.members.delete(peerId)
      this.onMemberLeftCallbacks.forEach((cb) => cb(peerId))
      this.notifyStateChange()
    })
  }

  toggleMic(): boolean {
    if (!this.localStream) return false
    this.micEnabled = !this.micEnabled
    this.localStream.getAudioTracks().forEach((t) => { t.enabled = this.micEnabled })
    this.notifyStateChange()
    return this.micEnabled
  }

  async toggleCamera(): Promise<boolean> {
    if (!this.localStream) return false

    if (this.cameraEnabled) {
      // Remove video tracks
      this.localStream.getVideoTracks().forEach((t) => {
        t.stop()
        this.localStream!.removeTrack(t)
      })
      this.cameraEnabled = false
    } else {
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true })
        const videoTrack = videoStream.getVideoTracks()[0]
        this.localStream.addTrack(videoTrack)
        this.cameraEnabled = true
      } catch {
        this.cameraEnabled = false
      }
    }
    this.notifyStateChange()
    return this.cameraEnabled
  }

  // Event subscriptions
  onMemberJoined(cb: MemberEventHandler) { this.onMemberJoinedCallbacks.push(cb) }
  onMemberLeft(cb: (peerId: string) => void) { this.onMemberLeftCallbacks.push(cb) }
  onStateChange(cb: VoiceEventHandler) { this.onStateChangeCallbacks.push(cb) }

  offStateChange(cb: VoiceEventHandler) {
    this.onStateChangeCallbacks = this.onStateChangeCallbacks.filter((c) => c !== cb)
  }

  offMemberJoined(cb: MemberEventHandler) {
    this.onMemberJoinedCallbacks = this.onMemberJoinedCallbacks.filter((c) => c !== cb)
  }

  offMemberLeft(cb: (peerId: string) => void) {
    this.onMemberLeftCallbacks = this.onMemberLeftCallbacks.filter((c) => c !== cb)
  }

  private notifyStateChange() {
    this.onStateChangeCallbacks.forEach((cb) => cb())
  }
}

export const voiceService = new VoiceService()
export default voiceService
