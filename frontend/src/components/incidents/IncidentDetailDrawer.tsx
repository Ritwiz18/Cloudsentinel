import React, { useState, useEffect } from 'react';
import { apiClient, ApiError } from '../../api/client';
import type { IncidentDetail, SecurityAlert } from '../../types/api';
import { Drawer } from '../common/Drawer';
import { SeverityBadge } from '../common/SeverityBadge';
import { StatusBadge } from '../common/StatusBadge';
import { RiskScorePill } from '../common/RiskScorePill';
import { IncidentStatusModal } from './IncidentStatusModal';
import { IncidentInvestigationView } from './IncidentInvestigationView';
import {
  Clock,
  Edit3,
  History,
  Link,
  User,
} from 'lucide-react';

interface Props {
  incidentId: string | null;
  onClose: () => void;
  onIncidentUpdated?: () => void;
}

interface ContentProps {
  incidentId: string;
  onClose: () => void;
  onIncidentUpdated?: () => void;
}

const IncidentDetailDrawerContent: React.FC<ContentProps> = ({
  incidentId,
  onClose,
  onIncidentUpdated,
}) => {
  const [detail, setDetail] = useState<IncidentDetail | null>(null);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  useEffect(() => {
    const isMountedRef = { current: true };
    Promise.all([
      apiClient.getIncidentById(incidentId),
      apiClient.getIncidentAlerts(incidentId),
    ])
      .then(([incDetail, incAlerts]) => {
        if (!isMountedRef.current) return;
        setDetail(incDetail);
        setAlerts(incAlerts);
        setLoading(false);
      })
      .catch((err: any) => {
        if (!isMountedRef.current) return;
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('Failed to load incident details');
        }
        setLoading(false);
      });

    return () => {
      isMountedRef.current = false;
    };
  }, [incidentId]);

  return (
    <>
      <Drawer
        isOpen={true}
        onClose={onClose}
        title={detail?.title || 'Incident Investigation'}
        subtitle={detail?.incident_id || incidentId}
      >
        {loading ? (
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Loading incident details & alerts...</p>
        ) : error ? (
          <p style={{ color: '#f87171', fontSize: '0.9rem' }}>{error}</p>
        ) : detail ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <SeverityBadge severity={detail.severity} />
                <StatusBadge status={detail.status} />
                <RiskScorePill score={detail.risk_score} />
              </div>
              <button
                className="btn btn-primary"
                onClick={() => setIsEditOpen(true)}
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                data-testid="edit-incident-btn"
              >
                <Edit3 size={13} /> Update Status
              </button>
            </div>

            <div>
              <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '0.65rem', letterSpacing: '0.05em' }}>
                AI-Assisted Security Investigation
              </h4>
              <IncidentInvestigationView incidentId={detail.incident_id} />
            </div>

            <div>
              <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
                Summary & Attribution
              </h4>
              <p style={{ fontSize: '0.88rem', color: '#e2e8f0', lineHeight: '1.5', marginBottom: '0.75rem' }}>
                {detail.summary}
              </p>
              <div className="detail-grid">
                <span className="detail-label"><User size={13} style={{ display: 'inline', marginRight: 4 }} /> Assignee</span>
                <span className="detail-val" style={{ fontWeight: 600 }}>{detail.assigned_analyst || 'Unassigned'}</span>

                <span className="detail-label"><Clock size={13} style={{ display: 'inline', marginRight: 4 }} /> First Observed</span>
                <span className="detail-val font-mono">{new Date(detail.first_seen).toUTCString()}</span>

                <span className="detail-label"><Clock size={13} style={{ display: 'inline', marginRight: 4 }} /> Last Observed</span>
                <span className="detail-val font-mono">{new Date(detail.last_seen).toUTCString()}</span>

                <span className="detail-label"><Link size={13} style={{ display: 'inline', marginRight: 4 }} /> Pivot Key</span>
                <span className="detail-val font-mono" style={{ fontSize: '0.75rem' }}>{detail.correlation_fingerprint}</span>
              </div>
            </div>

            {detail.resolution_reason && (
              <div
                style={{
                  padding: '0.85rem',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                }}
                data-testid="resolution-reason-display"
              >
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#34d399', fontWeight: 700, marginBottom: '0.25rem' }}>
                  Resolution Rationale ({detail.status})
                </div>
                <div style={{ fontSize: '0.85rem', color: '#f1f5f9' }}>{detail.resolution_reason}</div>
              </div>
            )}

            <div>
              <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
                Correlation Rationale
              </h4>
              <ul style={{ paddingLeft: '1.25rem', fontSize: '0.82rem', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {detail.correlation_reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>

            <div>
              <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '0.65rem', letterSpacing: '0.05em' }}>
                Correlated Security Alerts ({alerts.length})
              </h4>
              {alerts.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '0.82rem' }}>No alerts attached</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {alerts.map((alt) => (
                    <div
                      key={alt.alert_id}
                      style={{
                        padding: '0.7rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#f1f5f9' }}>{alt.title}</div>
                        <SeverityBadge severity={alt.severity} showIcon={false} />
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', gap: '0.75rem' }}>
                        <span className="font-mono">{alt.rule_id}</span>
                        <span>Risk: {alt.risk_score}</span>
                        <span>{new Date(alt.last_seen).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '0.65rem', letterSpacing: '0.05em' }}>
                <History size={14} style={{ display: 'inline', marginRight: 4 }} /> Chronological Audit Ledger ({detail.audits?.length || 0})
              </h4>
              {detail.audits && detail.audits.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {detail.audits.map((a) => (
                    <div
                      key={a.id}
                      style={{
                        padding: '0.65rem',
                        backgroundColor: '#070a10',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                      }}
                      data-testid={`audit-entry-${a.id}`}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1', fontWeight: 600, marginBottom: '0.2rem' }}>
                        <span>{a.action}</span>
                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          {new Date(a.created_at).toISOString().replace('T', ' ').slice(0, 19)}
                        </span>
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                        Actor: {a.actor || 'system'} {a.reason ? `• Reason: "${a.reason}"` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: '#64748b', fontSize: '0.82rem' }}>No audit history recorded</p>
              )}
            </div>
          </>
        ) : null}
      </Drawer>

      <IncidentStatusModal
        incident={detail}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSuccess={(updated) => {
          setDetail(updated);
          if (onIncidentUpdated) onIncidentUpdated();
        }}
      />
    </>
  );
};

export const IncidentDetailDrawer: React.FC<Props> = ({
  incidentId,
  onClose,
  onIncidentUpdated,
}) => {
  if (!incidentId) return null;

  return (
    <IncidentDetailDrawerContent
      key={incidentId}
      incidentId={incidentId}
      onClose={onClose}
      onIncidentUpdated={onIncidentUpdated}
    />
  );
};
