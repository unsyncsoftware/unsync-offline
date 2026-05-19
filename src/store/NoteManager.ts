import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import type { NoteMetadata } from './types';

export class NoteManager {
  public doc: Y.Doc;
  public provider: IndexeddbPersistence;
  public metadata: Y.Map<NoteMetadata>;

  constructor() {
    this.doc = new Y.Doc();
    this.provider = new IndexeddbPersistence('antigravity-notepad', this.doc);
    this.metadata = this.doc.getMap<NoteMetadata>('metadata');
  }

  public createNote(): string {
    const id = crypto.randomUUID();
    const now = Date.now();
    
    const meta: NoteMetadata = {
      id,
      title: 'Untitled Note',
      createdAt: now,
      updatedAt: now,
    };
    
    this.metadata.set(id, meta);
    return id;
  }

  public getNoteText(id: string): Y.Text {
    return this.doc.getText(id);
  }

  public getNoteMetadata(id: string): NoteMetadata | undefined {
    return this.metadata.get(id);
  }

  public updateNoteTitle(id: string, title: string) {
    const meta = this.metadata.get(id);
    if (meta) {
      this.metadata.set(id, { ...meta, title, updatedAt: Date.now() });
    }
  }

  public deleteNote(id: string) {
    this.metadata.delete(id);
  }

  public async whenSynced(): Promise<void> {
    return new Promise((resolve) => {
      if (this.provider.synced) {
        resolve();
      } else {
        this.provider.once('synced', () => resolve());
      }
    });
  }
}

export const noteManager = new NoteManager();
