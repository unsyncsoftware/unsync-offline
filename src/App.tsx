import { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Editor } from './components/Editor';
import { noteManager } from './store/NoteManager';
import { Lock } from 'lucide-react';

function App() {
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        // This is your local database worker (IndexedDB). 
        // It stays active to read/write notes directly to your hard drive!
        await noteManager.whenSynced();
      } catch (e) {
        console.error('Failed to initialize local data store', e);
      } finally {
        setIsInitializing(false);
      }
    };

    init();
  }, []);

  if (isInitializing) {
    return (
      <div className="app-container" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-muted)' }}>Initializing Offline Environment...</div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '280px', borderRight: '1px solid var(--border)' }} className="glass">
        <Sidebar 
          activeNoteId={activeNoteId} 
          onSelectNote={setActiveNoteId} 
          onOpenPairing={() => {}} // Disabled for offline
        />
        <div className="sidebar-footer">
          {/* ❌ Network Sync Status removed from here */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
            <Lock size={12} /> 100% Standalone & Local
          </div>
        </div>
      </div>
      
      <main className="main-content">
        {activeNoteId ? (
          <Editor noteId={activeNoteId} onDelete={() => setActiveNoteId(null)} />
        ) : (
          <div className="empty-state">
            <Lock size={48} opacity={0.2} />
            <div style={{ fontSize: '18px', fontWeight: 500 }}>Unsync Offline</div>
            <div style={{ fontSize: '14px', maxWidth: '300px', textAlign: 'center' }}>
              Your notes are completely private, isolated, and safely saved onto this local machine.
            </div>
            {/* ❌ "View Identity" button removed from here */}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;