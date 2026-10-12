import React from 'react';
import { ArrowRight } from 'lucide-react';
import type { SecurityIncident } from '../../types/api';
import { SeverityBadge } from '../common/SeverityBadge';
import { StatusBadge } from '../common/StatusBadge';

interface Props {
  incidents: SecurityIncident[];
  onSelectIncident: (incident: SecurityIncident) => void;
  onViewAll: () => void;
}

export const RecentIncidentsList: React.FC<Props> = ({ incidents, onSelectIncident, onViewAll }) => {
  return (
    <div className="panel-card" style={{ flex: 1 }} data-testid="recent-incidents-card">
      <div className="panel-header">
        <h3 className="panel-title">Recent Correlated Incidents</h3>
        <button
          className="btn btn-secondary"
          onClick={onViewAll}
          style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
        >
          View All <ArrowRight size={13} />
        </button>
      </div>

      {incidents.length === 0 ? (
        <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No recent security incidents recorded.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {incidents.slice(0, 5).map((inc) => (
            <div
              key={inc.incident_id}
              onClick={() => onSelectIncident(inc)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem',
                borderRadius: '6px',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.04)',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                <SeverityBadge severity={inc.severity} showIcon={false} />
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#f1f5f9' }}>
                    {inc.title}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                    <span className="font-mono">{inc.incident_id}</span> •{' '}
                    {inc.related_alert_ids?.length || 0} Alerts
                  </div>
                </div>
              </div>
              <StatusBadge status={inc.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
