import type { AntiGravityIdentity } from '../store/types';

type EventHandler = (...args: any[]) => void;

export class AntiGravityClient {
  public identity: AntiGravityIdentity;
  private roomName: string;
  private peers: Map<string, RTCPeerConnection> = new Map();
  private channels: Map<string, RTCDataChannel> = new Map();
  private sharedSecrets: Map<string, CryptoKey> = new Map();
  private listeners: Map<string, Set<EventHandler>> = new Map();
  
  // Simulated introduction point via BroadcastChannel
  private signalingChannel: BroadcastChannel;

  constructor(identity: AntiGravityIdentity, roomName: string = 'ag-global') {
    this.identity = identity;
    this.roomName = roomName;
    this.signalingChannel = new BroadcastChannel(`ag-signal-${this.roomName}`);
    
    this.signalingChannel.onmessage = this.handleSignalingMessage.bind(this);
  }

  public on(event: string, handler: EventHandler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  public emit(event: string, ...args: any[]) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach(h => h(...args));
    }
  }

  public async connect() {
    const exportedKey = await crypto.subtle.exportKey('raw', this.identity.publicKey);
    const keyArray = Array.from(new Uint8Array(exportedKey));

    this.signalingChannel.postMessage({
      type: 'announce',
      senderId: this.identity.peerId,
      publicKey: keyArray
    });
  }

  private async getImportedKey(keyArray: number[]): Promise<CryptoKey> {
    const rawKey = new Uint8Array(keyArray).buffer;
    return await crypto.subtle.importKey(
      'raw',
      rawKey,
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      []
    );
  }

  private async deriveSharedSecret(peerId: string, remotePubKeyArray: number[]) {
    const remoteKey = await this.getImportedKey(remotePubKeyArray);
    const sharedSecret = await crypto.subtle.deriveKey(
      { name: 'ECDH', public: remoteKey },
      this.identity.privateKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    this.sharedSecrets.set(peerId, sharedSecret);
  }

  private async encryptMessage(peerId: string, data: Uint8Array): Promise<Uint8Array> {
    const secret = this.sharedSecrets.get(peerId);
    if (!secret) throw new Error('No shared secret for peer');
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      secret,
      data as any // Workaround TS buffer strictness
    );
    
    const result = new Uint8Array(iv.length + encrypted.byteLength);
    result.set(iv, 0);
    result.set(new Uint8Array(encrypted), iv.length);
    return result;
  }

  private async decryptMessage(peerId: string, data: Uint8Array): Promise<Uint8Array> {
    const secret = this.sharedSecrets.get(peerId);
    if (!secret) throw new Error('No shared secret for peer');

    const iv = data.slice(0, 12);
    const encrypted = data.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      secret,
      encrypted
    );
    return new Uint8Array(decrypted);
  }

  private async handleSignalingMessage(event: MessageEvent) {
    const msg = event.data;
    if (msg.senderId === this.identity.peerId) return;

    if (msg.type === 'announce') {
      await this.deriveSharedSecret(msg.senderId, msg.publicKey);
      await this.initiateConnection(msg.senderId);
    } else if (msg.type === 'offer' && msg.targetId === this.identity.peerId) {
      if (msg.publicKey) {
        await this.deriveSharedSecret(msg.senderId, msg.publicKey);
      }
      await this.handleOffer(msg.senderId, msg.offer);
    } else if (msg.type === 'answer' && msg.targetId === this.identity.peerId) {
      await this.handleAnswer(msg.senderId, msg.answer);
    } else if (msg.type === 'ice-candidate' && msg.targetId === this.identity.peerId) {
      const peer = this.peers.get(msg.senderId);
      if (peer && peer.remoteDescription) {
        try {
          await peer.addIceCandidate(new RTCIceCandidate(msg.candidate));
        } catch (e) {
          console.error('Error adding ICE candidate', e);
        }
      }
    }
  }

  private createPeerConnection(peerId: string): RTCPeerConnection {
    const peer = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        this.signalingChannel.postMessage({
          type: 'ice-candidate',
          senderId: this.identity.peerId,
          targetId: peerId,
          candidate: event.candidate
        });
      }
    };

    peer.ondatachannel = (event) => {
      this.setupDataChannel(peerId, event.channel);
    };

    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'disconnected' || peer.connectionState === 'failed') {
        this.handlePeerDisconnect(peerId);
      }
    };

    this.peers.set(peerId, peer);
    return peer;
  }

  private setupDataChannel(peerId: string, channel: RTCDataChannel) {
    channel.binaryType = 'arraybuffer';
    channel.onopen = () => {
      this.channels.set(peerId, channel);
      this.emit('peer-connected', peerId);
      this.emit('peers-changed', this.getConnectedPeers());
    };
    channel.onclose = () => {
      this.handlePeerDisconnect(peerId);
    };
    channel.onmessage = async (event) => {
      if (event.data instanceof ArrayBuffer) {
        try {
          const encrypted = new Uint8Array(event.data);
          const decrypted = await this.decryptMessage(peerId, encrypted);
          this.emit('message', peerId, decrypted);
        } catch (e) {
          console.error('Failed to decrypt message from peer', e);
        }
      }
    };
  }

  private async initiateConnection(peerId: string) {
    if (this.peers.has(peerId)) return;

    const peer = this.createPeerConnection(peerId);
    const channel = peer.createDataChannel('antigravity-sync');
    this.setupDataChannel(peerId, channel);

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    const exportedKey = await crypto.subtle.exportKey('raw', this.identity.publicKey);

    this.signalingChannel.postMessage({
      type: 'offer',
      senderId: this.identity.peerId,
      targetId: peerId,
      offer,
      publicKey: Array.from(new Uint8Array(exportedKey))
    });
  }

  private async handleOffer(peerId: string, offer: RTCSessionDescriptionInit) {
    let peer = this.peers.get(peerId);
    if (!peer) {
      peer = this.createPeerConnection(peerId);
    }
    
    await peer.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);

    this.signalingChannel.postMessage({
      type: 'answer',
      senderId: this.identity.peerId,
      targetId: peerId,
      answer
    });
  }

  private async handleAnswer(peerId: string, answer: RTCSessionDescriptionInit) {
    const peer = this.peers.get(peerId);
    if (peer) {
      await peer.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }

  private handlePeerDisconnect(peerId: string) {
    this.peers.get(peerId)?.close();
    this.peers.delete(peerId);
    this.channels.delete(peerId);
    this.sharedSecrets.delete(peerId);
    this.emit('peer-disconnected', peerId);
    this.emit('peers-changed', this.getConnectedPeers());
  }

  public async broadcast(data: Uint8Array) {
    for (const [peerId, channel] of this.channels.entries()) {
      if (channel.readyState === 'open') {
        try {
          const encrypted = await this.encryptMessage(peerId, data);
          channel.send(encrypted as any);
        } catch (e) {
          console.error(`Failed to send message to ${peerId}`, e);
        }
      }
    }
  }

  public getConnectedPeers(): string[] {
    return Array.from(this.channels.keys());
  }
}
