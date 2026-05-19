import React, { useEffect, useState } from 'react';
import { AntiGravityClient } from '../network/AntiGravityClient';

interface SyncStatusProps {
  client: AntiGravityClient | null;
}

export const SyncStatus: React.FC<SyncStatusProps> = ({ client }) => {
  const [peerCount, setPeerCount] = useState(0);

  useEffect(() => {
    if (!client) return;

    const handlePeersChanged = (peers: string[]) => {
      setPeerCount(peers.length);
    };

    client.on('peers-changed', handlePeersChanged);
    setPeerCount(client.getConnectedPeers().length);
  }, [client]);

  return (
    <div className="sync-status">
      <div className={`sync-dot ${peerCount > 0 ? 'syncing' : 'offline'}`}></div>
      <span>{peerCount > 0 ? `Synced with ${peerCount} devices` : 'Offline'}</span>
    </div>
  );
};
