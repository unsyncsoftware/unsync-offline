export interface NoteMetadata {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface AntiGravityIdentity {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  peerId: string;
}

export interface PeerDevice {
  peerId: string;
  status: 'connected' | 'disconnected' | 'syncing';
}
