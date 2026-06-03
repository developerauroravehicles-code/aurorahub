/**
 * WebRTC mesh audio for small meet rooms (2–6 participants).
 * Signaling via Supabase Realtime broadcast.
 */

export function getIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }]

  const turnUrls = process.env.NEXT_PUBLIC_TURN_URLS
  const turnUser = process.env.NEXT_PUBLIC_TURN_USERNAME
  const turnCred = process.env.NEXT_PUBLIC_TURN_CREDENTIAL

  if (turnUrls) {
    servers.push({
      urls: turnUrls.split(',').map((u) => u.trim()),
      username: turnUser,
      credential: turnCred,
    })
  }

  const stunUrls = process.env.NEXT_PUBLIC_STUN_URLS
  if (stunUrls) {
    for (const url of stunUrls.split(',')) {
      const trimmed = url.trim()
      if (trimmed) servers.unshift({ urls: trimmed })
    }
  }

  return servers
}

export type MeshPeerCallbacks = {
  onRemoteStream: (peerId: string, stream: MediaStream) => void
  onPeerDisconnected: (peerId: string) => void
  onSpeakingChange?: (peerId: string, speaking: boolean) => void
}

export class MeetMeshManager {
  private localStream: MediaStream | null = null
  private peers = new Map<string, RTCPeerConnection>()
  private sendSignal: (event: import('./realtime').MeetSignalEvent) => Promise<void>
  private userId: string
  private callbacks: MeshPeerCallbacks
  private makingOffer = new Set<string>()
  private onScreenShareEnd?: () => void

  constructor(
    userId: string,
    sendSignal: (event: import('./realtime').MeetSignalEvent) => Promise<void>,
    callbacks: MeshPeerCallbacks,
    options?: { onScreenShareEnd?: () => void }
  ) {
    this.userId = userId
    this.sendSignal = sendSignal
    this.callbacks = callbacks
    this.onScreenShareEnd = options?.onScreenShareEnd
  }

  async startLocalAudio(): Promise<MediaStream> {
    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    return this.localStream
  }

  async enableCamera(): Promise<boolean> {
    if (!this.localStream) return false
    if (this.localStream.getVideoTracks().length > 0) {
      this.localStream.getVideoTracks().forEach((t) => { t.enabled = true })
      return true
    }
    try {
      const video = await navigator.mediaDevices.getUserMedia({ video: true })
      const track = video.getVideoTracks()[0]
      this.localStream.addTrack(track)
      await this.renegotiateAllPeers()
      return true
    } catch {
      return false
    }
  }

  disableCamera() {
    this.localStream?.getVideoTracks().forEach((t) => {
      t.enabled = false
    })
  }

  removeCamera() {
    this.localStream?.getVideoTracks().forEach((t) => {
      t.stop()
      this.localStream?.removeTrack(t)
    })
    void this.renegotiateAllPeers()
  }

  async startScreenShare(): Promise<MediaStream | null> {
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
      const track = display.getVideoTracks()[0]
      track.onended = () => {
        this.stopScreenShare()
        this.onScreenShareEnd?.()
      }
      if (this.localStream) {
        this.localStream.getVideoTracks().forEach((t) => {
          t.stop()
          this.localStream?.removeTrack(t)
        })
        this.localStream.addTrack(track)
        await this.renegotiateAllPeers()
      }
      return display
    } catch {
      return null
    }
  }

  stopScreenShare() {
    this.localStream?.getVideoTracks().forEach((t) => {
      if (t.label.includes('screen') || t.label.includes('Screen') || t.label.includes('display')) {
        t.stop()
        this.localStream?.removeTrack(t)
      }
    })
    void this.renegotiateAllPeers()
  }

  private async renegotiateAllPeers() {
    for (const [peerId, pc] of this.peers) {
      if (!this.localStream) continue
      const senders = pc.getSenders()
      for (const track of this.localStream.getTracks()) {
        const existing = senders.find((s) => s.track?.kind === track.kind)
        if (existing) {
          await existing.replaceTrack(track)
        } else {
          pc.addTrack(track, this.localStream)
        }
      }
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      await this.sendSignal({ type: 'offer', from: this.userId, to: peerId, sdp: offer })
    }
  }

  getLocalStream(): MediaStream | null {
    return this.localStream
  }

  setMuted(muted: boolean) {
    this.localStream?.getAudioTracks().forEach((t) => {
      t.enabled = !muted
    })
  }

  async connectToPeer(peerId: string) {
    if (peerId === this.userId || this.peers.has(peerId)) return
    await this.createPeerConnection(peerId, true)
  }

  async handleSignal(event: import('./realtime').MeetSignalEvent) {
    if (event.from === this.userId) return

    switch (event.type) {
      case 'offer': {
        const pc = await this.createPeerConnection(event.from, false)
        await pc.setRemoteDescription(new RTCSessionDescription(event.sdp))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        await this.sendSignal({ type: 'answer', from: this.userId, to: event.from, sdp: answer })
        break
      }
      case 'answer': {
        const pc = this.peers.get(event.from)
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(event.sdp))
        break
      }
      case 'ice-candidate': {
        const pc = this.peers.get(event.from)
        if (pc && event.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(event.candidate)).catch(() => {})
        }
        break
      }
      case 'participant-left':
        this.removePeer(event.from)
        break
    }
  }

  private async createPeerConnection(peerId: string, initiator: boolean): Promise<RTCPeerConnection> {
    const existing = this.peers.get(peerId)
    if (existing) return existing

    const pc = new RTCPeerConnection({ iceServers: getIceServers() })
    this.peers.set(peerId, pc)

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        pc.addTrack(track, this.localStream)
      }
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        void this.sendSignal({
          type: 'ice-candidate',
          from: this.userId,
          to: peerId,
          candidate: e.candidate.toJSON(),
        })
      }
    }

    pc.ontrack = (e) => {
      if (e.streams[0]) {
        this.callbacks.onRemoteStream(peerId, e.streams[0])
      }
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed' || pc.connectionState === 'disconnected') {
        this.removePeer(peerId)
      }
    }

    if (initiator && !this.makingOffer.has(peerId)) {
      this.makingOffer.add(peerId)
      try {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        await this.sendSignal({ type: 'offer', from: this.userId, to: peerId, sdp: offer })
      } finally {
        this.makingOffer.delete(peerId)
      }
    }

    return pc
  }

  removePeer(peerId: string) {
    const pc = this.peers.get(peerId)
    if (pc) {
      pc.close()
      this.peers.delete(peerId)
      this.callbacks.onPeerDisconnected(peerId)
    }
  }

  async leave() {
    for (const peerId of [...this.peers.keys()]) {
      this.removePeer(peerId)
    }
    await this.sendSignal({ type: 'participant-left', from: this.userId })
    this.localStream?.getTracks().forEach((t) => t.stop())
    this.localStream = null
  }
}
