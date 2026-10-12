import React from 'react';
import type { SecurityEvent } from '../../types/api';
import { Drawer } from '../common/Drawer';
import { Bot, CheckCircle, Clock, Globe, Shield, User, XCircle } from 'lucide-react';

interface Props {
  event: SecurityEvent | null;
  onClose: () => void;
}

export const EventDetailDrawer: React.FC<Props> = ({ event, onClose }) => {
  if (!event) return null;

  const isSynthetic = Boolean(event.metadata && (event.metadata.is_synthetic || event.source === 'simulator'));

  return (
    <Drawer
      isOpen={Boolean(event)}
      onClose={onClose}
      title="Security Event Inspector"
      subtitle={event.event_id}
    >
      {isSynthetic && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.65rem 0.85rem',
            borderRadius: '6px',
            backgroundColor: 'rgba(6, 182, 212, 0.1)',
            border: '1px solid rgba(6, 182, 212, 0.3)',
            color: '#38bdf8',
            fontSize: '0.8rem',
            fontWeight: 600,
          }}
          data-testid="synthetic-event-banner"
        >
          <Bot size={16} /> Synthetic Simulation Event (Non-production test data)
        </div>
      )}

      <div>
        <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>
          Event Parameters
        </h4>
        <div className="detail-grid">
          <span className="detail-label"><Clock size={13} style={{ display: 'inline', marginRight: 4 }} /> Timestamp</span>
          <span className="detail-val font-mono">{new Date(event.timestamp).toUTCString()}</span>

          <span className="detail-label"><Shield size={13} style={{ display: 'inline', marginRight: 4 }} /> Event Type</span>
          <span className="detail-val" style={{ fontWeight: 600 }}>{event.event_type}</span>

          <span className="detail-label">Source</span>
          <span className="detail-val font-mono">{event.source}</span>

          <span className="detail-label">Outcome</span>
          <span className="detail-val">
            <span className={`badge-outcome ${event.outcome}`}>
              {event.outcome === 'SUCCESS' ? <CheckCircle size={11} style={{ display: 'inline', marginRight: 3 }} /> : <XCircle size={11} style={{ display: 'inline', marginRight: 3 }} />}
              {event.outcome}
            </span>
          </span>

          <span className="detail-label"><User size={13} style={{ display: 'inline', marginRight: 4 }} /> Principal Actor</span>
          <span className="detail-val font-mono">{event.actor || '—'}</span>

          <span className="detail-label"><Globe size={13} style={{ display: 'inline', marginRight: 4 }} /> Source IP</span>
          <span className="detail-val font-mono">{event.source_ip || '—'}</span>

          <span className="detail-label">Target Resource</span>
          <span className="detail-val font-mono">{event.resource || '—'}</span>

          <span className="detail-label">AWS Account / Region</span>
          <span className="detail-val font-mono">
            {event.account_id || '—'} {event.region ? `(${event.region})` : ''}
          </span>

          <span className="detail-label">Ingested At</span>
          <span className="detail-val font-mono">{new Date(event.ingested_at).toUTCString()}</span>
        </div>
      </div>

      <div>
        <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
          Telemetry & Metadata (Raw Payload)
        </h4>
        <pre className="json-box">
          {JSON.stringify(event.metadata || {}, null, 2)}
        </pre>
      </div>
    </Drawer>
  );
};
