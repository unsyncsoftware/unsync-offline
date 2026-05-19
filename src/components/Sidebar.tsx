import { useEffect, useState } from 'react';
import { Plus, Settings } from 'lucide-react';
import { noteManager } from '../store/NoteManager';
import type { NoteMetadata } from '../store/types';

interface SidebarProps {
  activeNoteId: string | null;
  onSelectNote: (id: string) => void;
  onOpenPairing: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeNoteId, onSelectNote, onOpenPairing }) => {
  const [notes, setNotes] = useState<NoteMetadata[]>([]);

  useEffect(() => {
    const updateNotes = () => {
      const allNotes = Array.from(noteManager.metadata.values());
      allNotes.sort((a, b) => b.updatedAt - a.updatedAt);
      setNotes(allNotes);
    };

    updateNotes();

    const observer = () => {
      updateNotes();
    };

    noteManager.metadata.observe(observer);
    return () => noteManager.metadata.unobserve(observer);
  }, []);

  const handleCreate = () => {
    const id = noteManager.createNote();
    onSelectNote(id);
  };

  return (
    <div className="sidebar glass">
      <div className="sidebar-header">
        <h2 style={{ fontSize: '16px' }}>unsync</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="icon-button" onClick={onOpenPairing} title="Pair Devices">
            <Settings size={18} />
          </button>
          <button className="icon-button" onClick={handleCreate} title="New Note">
            <Plus size={18} />
          </button>
        </div>
      </div>
      
      <div className="notes-list">
        {notes.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
            No notes yet. Create one!
          </div>
        ) : (
          notes.map(note => (
            <div
              key={note.id}
              className={`note-item ${activeNoteId === note.id ? 'active' : ''}`}
              onClick={() => onSelectNote(note.id)}
            >
              <div className="note-item-title">{note.title || 'Untitled Note'}</div>
              <div className="note-item-date">
                {new Date(note.updatedAt).toLocaleDateString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
