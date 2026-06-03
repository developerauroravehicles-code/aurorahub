/**
 * WebRTC mesh audio/video for small meet rooms (2–6 participants).
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

export type ScreenShareCursorMode = 'always' | 'motion' | 'never'

export function getPeerConnectionConfig(): RTCConfiguration {
  return {
    iceServers: getIceServers(),
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
  }
}

export type MeshPeerCallbacks = {
  onRemoteStream: (peerId: string, stream: MediaStream) => void
  onPeerDisconnected: (peerId: string) => void
  onRemoteAudioElement?: (peerId: string, element: HTMLAudioElement) => void
}

export class MeetMeshManager {
  private localStream: MediaStream | null = null
  private peers = new Map<string, RTCPeerConnection>()
  private remoteStreams = new Map<string, MediaStream>()
  private remoteAudioElements = new Map<string, HTMLAudioElement>()
  private sendSignal: (event: import('./realtime').MeetSignalEvent) => Promise<void>
  private userId: string
  private callbacks: MeshPeerCallbacks
  private makingOffer = new Set<string>()
  private renegotiatePending = new Set<string>()
  private onScreenShareEnd?: () => void
  private audioInputDeviceId: string | null = null
  private audioOutputDeviceId: string | null = null
  private screenShareCursorMode: ScreenShareCursorMode = 'always'

  constructor(
    userId: string,
    sendSignal: (event: import('./realtime').MeetSignalEvent) => Promise<void>,
    callbacks: MeshPeerCallbacks,
    options?: {
      onScreenShareEnd?: () => void
      audioInputDeviceId?: string
      audioOutputDeviceId?: string
      screenShareCursorMode?: ScreenShareCursorMode
    }
  ) {
    this.userId = userId
    this.sendSignal = sendSignal
    this.callbacks = callbacks
    this.onScreenShareEnd = options?.onScreenShareEnd
    this.audioInputDeviceId = options?.audioInputDeviceId ?? null
    this.audioOutputDeviceId = options?.audioOutputDeviceId ?? null
    this.screenShareCursorMode = options?.screenShareCursorMode ?? 'always'
  }

  setScreenShareCursorMode(mode: ScreenShareCursorMode) {
    this.screenShareCursorMode = mode
  }

  getScreenShareCursorMode() {
    return this.screenShareCursorMode
  }

  async applyScreenShareCursorMode(mode: ScreenShareCursorMode): Promise<boolean> {
    this.screenShareCursorMode = mode
    const track = this.localStream?.getVideoTracks().find((t) => this.isScreenTrack(t))
    if (!track) return true
    try {
      await track.applyConstraints({ cursor: mode } as MediaTrackConstraints)
      return true
    } catch {
      return false
    }
  }

  async startLocalAudio(deviceId?: string): Promise<MediaStream> {
    const constraints: MediaStreamConstraints = {
      audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      video: false,
    }
    this.localStream = await navigator.mediaDevices.getUserMedia(constraints)
    if (deviceId) this.audioInputDeviceId = deviceId
    return this.localStream
  }

  async setAudioInputDevice(deviceId: string): Promise<boolean> {
    try {
      const audio = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } },
        video: false,
      })
      const newTrack = audio.getAudioTracks()[0]
      if (!newTrack) return false

      const oldTracks = this.localStream?.getAudioTracks() ?? []
      oldTracks.forEach((t) => {
        t.stop()
        this.localStream?.removeTrack(t)
      })

      if (!this.localStream) {
        this.localStream = new MediaStream([newTrack])
      } else {
        this.localStream.addTrack(newTrack)
      }

      this.audioInputDeviceId = deviceId
      await this.syncLocalTracksToAllPeers()
      await this.renegotiateAllPeers()
      return true
    } catch {
      return false
    }
  }

  setAudioOutputDevice(deviceId: string) {
    this.audioOutputDeviceId = deviceId
    for (const el of this.remoteAudioElements.values()) {
      void this.applySinkId(el, deviceId)
    }
  }

  getAudioInputDeviceId() {
    return this.audioInputDeviceId
  }

  getAudioOutputDeviceId() {
    return this.audioOutputDeviceId
  }

  private async applySinkId(el: HTMLAudioElement, deviceId: string) {
    const sink = el as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }
    if (typeof sink.setSinkId === 'function') {
      try {
        await sink.setSinkId(deviceId)
      } catch {
        // Browser may reject invalid or default device
      }
    }
  }

  async enableCamera(): Promise<boolean> {
    if (!this.localStream) return false
    if (this.localStream.getVideoTracks().length > 0) {
      this.localStream.getVideoTracks().forEach((t) => {
        t.enabled = true
      })
      return true
    }
    try {
      const video = await navigator.mediaDevices.getUserMedia({ video: true })
      const track = video.getVideoTracks()[0]
      this.localStream.addTrack(track)
      await this.syncLocalTracksToAllPeers()
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
      if (!this.isScreenTrack(t)) {
        t.stop()
        this.localStream?.removeTrack(t)
      }
    })
    void this.syncLocalTracksToAllPeers().then(() => this.renegotiateAllPeers())
  }

  async startScreenShare(cursorMode?: ScreenShareCursorMode): Promise<MediaStream | null> {
    const cursor = cursorMode ?? this.screenShareCursorMode
    this.screenShareCursorMode = cursor

    try {
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor } as MediaTrackConstraints,
        audio: false,
      })
      const track = display.getVideoTracks()[0]
      track.onended = () => {
        this.stopScreenShare()
        this.onScreenShareEnd?.()
      }

      if (!this.localStream) {
        this.localStream = new MediaStream([track])
      } else {
        this.localStream.getVideoTracks().forEach((t) => {
          t.stop()
          this.localStream?.removeTrack(t)
        })
        this.localStream.addTrack(track)
      }

      await this.syncLocalTracksToAllPeers()
      await this.renegotiateAllPeers()
      return display
    } catch {
      return null
    }
  }

  stopScreenShare() {
    this.localStream?.getVideoTracks().forEach((t) => {
      if (this.isScreenTrack(t)) {
        t.stop()
        this.localStream?.removeTrack(t)
      }
    })
    void this.syncLocalTracksToAllPeers().then(() => this.renegotiateAllPeers())
  }

  private isScreenTrack(track: MediaStreamTrack) {
    const label = track.label.toLowerCase()
    return label.includes('screen') || label.includes('display') || label.includes('window')
  }

  private async syncLocalTracksToAllPeers() {
    if (!this.localStream) return

    for (const pc of this.peers.values()) {
      const localTracks = this.localStream.getTracks()

      for (const track of localTracks) {
        const sender = pc.getSenders().find((s) => s.track?.kind === track.kind)
        if (sender) {
          if (sender.track?.id !== track.id) {
            await sender.replaceTrack(track)
          }
          continue
        }

        if (track.kind === 'video') {
          const videoTransceiver = pc
            .getTransceivers()
            .find((t) => !t.sender.track && (t.direction === 'recvonly' || t.direction === 'inactive'))
          if (videoTransceiver) {
            videoTransceiver.direction = 'sendrecv'
            await videoTransceiver.sender.replaceTrack(track)
            continue
          }
        }

        pc.addTrack(track, this.localStream)
      }

      for (const sender of pc.getSenders()) {
        if (!sender.track) continue
        const stillActive = localTracks.some((t) => t.kind === sender.track!.kind)
        if (!stillActive) {
          await sender.replaceTrack(null)
          const transceiver = pc.getTransceivers().find((t) => t.sender === sender)
          if (transceiver && transceiver.receiver.track?.kind === 'video') {
            transceiver.direction = 'recvonly'
          }
        }
      }
    }
  }

  private async renegotiateAllPeers() {
    await Promise.all([...this.peers.keys()].map((peerId) => this.renegotiatePeer(peerId)))
  }

  private async renegotiatePeer(peerId: string) {
    const pc = this.peers.get(peerId)
    if (!pc || !this.localStream) return

    if (pc.signalingState !== 'stable') {
      this.renegotiatePending.add(peerId)
      return
    }

    if (this.makingOffer.has(peerId)) return
    this.makingOffer.add(peerId)

    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      await this.sendSignal({ type: 'offer', from: this.userId, to: peerId, sdp: offer })
    } catch {
      this.renegotiatePending.add(peerId)
    } finally {
      this.makingOffer.delete(peerId)
    }
  }

  private setupPeerRenegotiation(peerId: string, pc: RTCPeerConnection) {
    pc.onsignalingstatechange = () => {
      if (pc.signalingState === 'stable' && this.renegotiatePending.has(peerId)) {
        this.renegotiatePending.delete(peerId)
        void this.renegotiatePeer(peerId)
      }
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
        let pc = this.peers.get(event.from)
        if (!pc) {
          pc = await this.createPeerConnection(event.from, false)
        }

        if (pc.signalingState === 'have-local-offer') {
          await pc.setLocalDescription({ type: 'rollback' } as RTCSessionDescriptionInit)
        }

        await pc.setRemoteDescription(new RTCSessionDescription(event.sdp))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        await this.sendSignal({ type: 'answer', from: this.userId, to: event.from, sdp: answer })
        break
      }
      case 'answer': {
        const pc = this.peers.get(event.from)
        if (!pc) break
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(event.sdp))
        }
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

  private notifyRemoteStream(peerId: string) {
    const stream = this.remoteStreams.get(peerId)
    if (stream) {
      // Fresh MediaStream reference so React re-renders when tracks change
      this.callbacks.onRemoteStream(peerId, new MediaStream(stream.getTracks()))
    }
  }

  private attachRemoteAudio(peerId: string, stream: MediaStream) {
    let audioEl = this.remoteAudioElements.get(peerId)
    if (!audioEl) {
      audioEl = document.createElement('audio')
      audioEl.autoplay = true
      audioEl.id = `audio-${peerId}`
      this.remoteAudioElements.set(peerId, audioEl)
      this.callbacks.onRemoteAudioElement?.(peerId, audioEl)
      if (this.audioOutputDeviceId) {
        void this.applySinkId(audioEl, this.audioOutputDeviceId)
      }
    }
    audioEl.srcObject = stream
  }

  private mergeRemoteTrack(peerId: string, track: MediaStreamTrack) {
    let stream = this.remoteStreams.get(peerId)
    if (!stream) {
      stream = new MediaStream()
      this.remoteStreams.set(peerId, stream)
    }

    const existing = stream.getTracks().find((t) => t.kind === track.kind)
    if (existing && existing.id !== track.id) {
      stream.removeTrack(existing)
    }
    if (!stream.getTracks().some((t) => t.id === track.id)) {
      stream.addTrack(track)
    }

    track.onended = () => {
      stream!.removeTrack(track)
      this.notifyRemoteStream(peerId)
    }

    this.attachRemoteAudio(peerId, stream)
    this.notifyRemoteStream(peerId)
  }

  private async createPeerConnection(peerId: string, initiator: boolean): Promise<RTCPeerConnection> {
    const existing = this.peers.get(peerId)
    if (existing) return existing

    const pc = new RTCPeerConnection(getPeerConnectionConfig())
    this.peers.set(peerId, pc)
    this.setupPeerRenegotiation(peerId, pc)

    // Ensure we can receive video when peer starts screen sharing later
    pc.addTransceiver('video', { direction: 'recvonly' })

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
      const track = e.track
      if (track) {
        this.mergeRemoteTrack(peerId, track)
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
    }
    this.renegotiatePending.delete(peerId)
    this.remoteStreams.delete(peerId)
    const audioEl = this.remoteAudioElements.get(peerId)
    audioEl?.remove()
    this.remoteAudioElements.delete(peerId)
    this.callbacks.onPeerDisconnected(peerId)
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

export async function enumerateAudioDevices() {
  const devices = await navigator.mediaDevices.enumerateDevices()
  return {
    inputs: devices.filter((d) => d.kind === 'audioinput'),
    outputs: devices.filter((d) => d.kind === 'audiooutput'),
  }
}
