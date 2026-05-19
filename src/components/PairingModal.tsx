
import type { AntiGravityIdentity } from '../store/types';

interface PairingModalProps {
  identity: AntiGravityIdentity | null;
  onClose: () => void;
}

export const PairingModal: React.FC<PairingModalProps> = ({ identity, onClose }) => {
  if (!identity) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Device Identity</h2>
          <button className="icon-button" onClick={onClose}>✕</button>
        </div>
        
        <div className="form-group">
          <label className="form-label">Your Peer ID</label>
          <input 
            type="text" 
            className="form-input" 
            value={identity.peerId} 
            readOnly 
            onClick={e => (e.target as HTMLInputElement).select()}
          />
        </div>

        <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
          This app uses the AntiGravity protocol to automatically discover and securely connect to other devices on the same local signaling channel. Ensure both devices are open to sync notes instantly.
        </p>

        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="button" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
};
