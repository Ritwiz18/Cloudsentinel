import React from 'react';
import type { SecurityAlert } from '../../types/api';
import { Drawer } from '../common/Drawer';
import { SeverityBadge } from '../common/SeverityBadge';
import { StatusBadge } from '../common/StatusBadge';
import { RiskScorePill } from '../common/RiskScorePill';
import { Clock, Hash, Layers, ShieldAlert } from 'lucide-react';

interface Props {
  alert: SecurityAlert | null;
  onClose: () => void;
}

export const AlertDetailDrawer: React.FC<Props> = ({ alert, onClose }) => {
  if (!alert) return null;

  return (
    <Drawer
      isOpen={Boolean(alert)}
      onClose={onClose}
      title={alert.title}
      subtitle={alert.alert_id}
    >
      <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <SeverityBadge severity={alert.severity} />
        <StatusBadge status={alert.status} />
        <RiskScorePill score={alert.risk_score} />
        <span
          style={{
            fontSize: '0.75rem',
            padding: '0.2rem 0.5rem',
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '4px',
            color: '#94a3b8',
          }}
        >
          Confidence: {(alert.confidence * 100).toFixed(0)}%
        </span>
      </div>

      <div>
        <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
          Rule & Summary
        </h4>
        <p style={{ fontSize: '0.9rem', color: '#cbd5e1', lineHeight: '1.5', marginBottom: '0.75rem' }}>
          {alert.description}
        </p>
        <div className="detail-grid">
          <span className="detail-label"><ShieldAlert size={13} style={{ display: 'inline', marginRight: 4 }} /> Rule Name</span>
          <span className="detail-val" style={{ fontWeight: 600 }}>{alert.rule_name}</span>

          <span className="detail-label">Rule ID</span>
          <span className="detail-val font-mono">{alert.rule_id}</span>

          <span className="detail-label"><Hash size={13} style={{ display: 'inline', marginRight: 4 }} /> Deduplication Key</span>
          <span className="detail-val font-mono" style={{ fontSize: '0.75rem' }}>{alert.fingerprint}</span>

          <span className="detail-label"><Layers size={13} style={{ display: 'inline', marginRight: 4 }} /> Occurrences</span>
          <span className="detail-val" style={{ fontWeight: 600 }}>{alert.occurrence_count} events</span>

          <span className="detail-label"><Clock size={13} style={{ display: 'inline', marginRight: 4 }} /> First Seen</span>
          <span className="detail-val font-mono">{new Date(alert.first_seen).toUTCString()}</span>

          <span className="detail-label"><Clock size={13} style={{ display: 'inline', marginRight: 4 }} /> Last Seen</span>
          <span className="detail-val font-mono">{new Date(alert.last_seen).toUTCString()}</span>
        </div>
      </div>

      <div>
        <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
          Related Canonical Event IDs ({alert.related_event_ids?.length || 0})
        </h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {alert.related_event_ids && alert.related_event_ids.length > 0 ? (
            alert.related_event_ids.map((id) => (
              <span
                key={id}
                className="font-mono"
                style={{
                  fontSize: '0.75rem',
                  padding: '0.2rem 0.5rem',
                  background: 'rgba(56, 189, 248, 0.1)',
                  color: '#38bdf8',
                  borderRadius: '4px',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                }}
              >
                {id}
              </span>
            ))
          ) : (
            <span style={{ color: '#64748b', fontSize: '0.85rem' }}>No related events recorded</span>
          )}
        </div>
      </div>

      <div>
        <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
          Diagnostic Evidence
        </h4>
        <pre className="json-box">
          {JSON.stringify(alert.evidence || {}, null, 2)}
        </pre>
      </div>
    </Drawer>
  );
};
