import type { AntiGravityIdentity } from '../store/types';

const DB_NAME = 'AntiGravityIdentityDB';
const STORE_NAME = 'IdentityStore';
const KEY_NAME = 'masterIdentity';

export class IdentityManager {
  private static async getDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private static async arrayBufferToBase64(buffer: ArrayBuffer): Promise<string> {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  public static async getOrGenerateIdentity(): Promise<AntiGravityIdentity> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(KEY_NAME);

      request.onsuccess = async () => {
        if (request.result) {
          resolve(request.result as AntiGravityIdentity);
        } else {
          try {
            const identity = await this.generateIdentity();
            await this.saveIdentity(identity, db);
            resolve(identity);
          } catch (e) {
            reject(e);
          }
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  private static async generateIdentity(): Promise<AntiGravityIdentity> {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true,
      ['deriveKey', 'deriveBits']
    );

    const rawPubKey = await crypto.subtle.exportKey('raw', keyPair.publicKey);
    const pubKeyHash = await crypto.subtle.digest('SHA-256', rawPubKey);
    const b64Hash = await this.arrayBufferToBase64(pubKeyHash);
    
    const peerId = 'ag_' + b64Hash.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);

    return {
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey,
      peerId,
    };
  }

  private static async saveIdentity(identity: AntiGravityIdentity, db: IDBDatabase): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(identity, KEY_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
