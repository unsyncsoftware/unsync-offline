import * as Y from 'yjs';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { AntiGravityClient } from './AntiGravityClient';

const MESSAGE_SYNC = 0;

export class AntiGravityProvider {
  private doc: Y.Doc;
  private client: AntiGravityClient;
  
  constructor(doc: Y.Doc, client: AntiGravityClient) {
    this.doc = doc;
    this.client = client;

    // Listen to local doc updates and broadcast them
    this.doc.on('update', this.onUpdate.bind(this));

    // Listen to network messages and apply them
    this.client.on('message', this.onMessage.bind(this));

    // When a peer connects, send them our sync step 1
    this.client.on('peer-connected', this.onPeerConnected.bind(this));
  }

  private onUpdate(update: Uint8Array, origin: any) {
    if (origin === this) return; // Don't broadcast updates we just applied from network

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    
    // Sync step 2: send the update
    encoding.writeVarUint(encoder, 2); 
    encoding.writeVarUint8Array(encoder, update);
    
    this.client.broadcast(encoding.toUint8Array(encoder));
  }

  private onMessage(_peerId: string, data: Uint8Array) {
    try {
      const decoder = decoding.createDecoder(data);
      const messageCategory = decoding.readVarUint(decoder);

      if (messageCategory === MESSAGE_SYNC) {
        const messageType = decoding.readVarUint(decoder);
        
        if (messageType === 1) {
          // Sync step 1: they sent their state vector, we send our missing updates
          const stateVector = decoding.readVarUint8Array(decoder);
          const update = Y.encodeStateAsUpdate(this.doc, stateVector);
          
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, MESSAGE_SYNC);
          encoding.writeVarUint(encoder, 2);
          encoding.writeVarUint8Array(encoder, update);
          
          // Broadcast the missing updates
          this.client.broadcast(encoding.toUint8Array(encoder));
        } else if (messageType === 2) {
          // Sync step 2: apply the update
          const update = decoding.readVarUint8Array(decoder);
          Y.applyUpdate(this.doc, update, this); // 'this' as origin so we don't rebroadcast
        }
      }
    } catch (e) {
      console.error('Error decoding Yjs message', e);
    }
  }

  private onPeerConnected(_peerId: string) {
    // Send sync step 1
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    encoding.writeVarUint(encoder, 1);
    encoding.writeVarUint8Array(encoder, Y.encodeStateVector(this.doc));
    
    this.client.broadcast(encoding.toUint8Array(encoder));
  }
}
