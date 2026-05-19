import { useEffect, useState, useRef } from 'react';
import { noteManager } from '../store/NoteManager';
import { Trash2 } from 'lucide-react';


interface EditorProps {
  noteId: string;
  onDelete: () => void;
}

export const Editor: React.FC<EditorProps> = ({ noteId, onDelete }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Load initial metadata
    const meta = noteManager.getNoteMetadata(noteId);
    if (meta) {
      setTitle(meta.title);
    }

    const text = noteManager.getNoteText(noteId);
    setContent(text.toString());

    // Observe metadata changes
    const metaObserver = () => {
      const updatedMeta = noteManager.getNoteMetadata(noteId);
      if (updatedMeta && updatedMeta.title !== title) {
        setTitle(updatedMeta.title);
      }
    };
    noteManager.metadata.observe(metaObserver);

    // Observe text changes
    const textObserver = () => {
      setContent(text.toString());
    };
    text.observe(textObserver);

    return () => {
      noteManager.metadata.unobserve(metaObserver);
      text.unobserve(textObserver);
    };
  }, [noteId]); // Removed title from dependency array to avoid infinite loop

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    noteManager.updateNoteTitle(noteId, newTitle);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    // For a robust Yjs editor, we'd use a binding (like y-prosemirror or y-monaco).
    // For a simple textarea, we compute the diff or just replace the whole text.
    // To maintain cursor position and avoid replacing the whole text on every keystroke,
    // we use a simple text diff logic or rely on the fact that replacing everything
    // works for simple use cases, though it's bad for CRDTs. 
    // Let's implement a very basic diff or just delete/insert.
    
    const ytext = noteManager.getNoteText(noteId);
    if (ytext.toString() !== newText) {
      // Very crude binding: Delete all and insert new. 
      // In production, use diff-match-patch or a proper rich text editor binding.
      ytext.delete(0, ytext.length);
      ytext.insert(0, newText);
      setContent(newText);
    }
  };

  const handleDelete = () => {
    noteManager.deleteNote(noteId);
    onDelete();
  };

  return (
    <div className="editor-container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <input
          type="text"
          className="editor-title"
          value={title}
          onChange={handleTitleChange}
          placeholder="Note Title"
        />
        <button className="icon-button" onClick={handleDelete} title="Delete Note">
          <Trash2 size={20} />
        </button>
      </div>
      <textarea
        ref={textareaRef}
        className="editor-textarea"
        value={content}
        onChange={handleTextChange}
        placeholder="Start typing..."
      />
    </div>
  );
};
