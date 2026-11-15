import React from 'react';
import { ArrowRight, ShieldAlert } from 'lucide-react';
import type { DashboardRecentIncident } from '../../types/api';
import { SeverityBadge } from '../common/SeverityBadge';
import { StatusBadge } from '../common/StatusBadge';

export interface RecentIncidentsListProps {
  incidents: DashboardRecentIncident[];
  onViewAll?: () => void;
  onSelectIncident?: (incident: DashboardRecentIncident) => void;
}

export const RecentIncidentsList: React.FC<RecentIncidentsListProps> = ({
  incidents,
  onViewAll,
  onSelectIncident,
}) => {
  return (
    <div className="panel-card" style={{ flex: 1, minWidth: 280 }} data-testid="recent-incidents-card">
      <div className="panel-header">
        <div className="panel-title">
          <ShieldAlert size={16} /> Recent Correlated Incidents
        </div>
        {onViewAll && (
          <button
            className="btn btn-secondary"
            onClick={onViewAll}
            style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
          >
            View All <ArrowRight size={13} />
          </button>
        )}
      </div>

      {incidents.length === 0 ? (
        <div className="state-box" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No recent security incidents recorded.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {incidents.slice(0, 6).map((inc) => (
            <div
              key={inc.incident_id}
              onClick={() => onSelectIncident?.(inc)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.65rem 0.75rem',
                borderRadius: '6px',
                backgroundColor: '#0a101d',
                border: '1px solid #162235',
                cursor: onSelectIncident ? 'pointer' : 'default',
                transition: 'background-color 0.15s ease, border-color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (onSelectIncident) {
                  e.currentTarget.style.backgroundColor = '#111b2b';
                  e.currentTarget.style.borderColor = '#19d3d040';
                }
              }}
              onMouseLeave={(e) => {
                if (onSelectIncident) {
                  e.currentTarget.style.backgroundColor = '#0a101d';
                  e.currentTarget.style.borderColor = '#162235';
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
                <StatusBadge status={inc.status} />
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {inc.title}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                    <span className="font-mono">{inc.incident_id}</span> ·{' '}
                    {inc.assigned_analyst ? `Analyst: ${inc.assigned_analyst}` : 'Unassigned'}
                  </div>
                </div>
              </div>
              <div style={{ marginLeft: '0.75rem', flexShrink: 0 }}>
                <SeverityBadge severity={inc.severity} showIcon={false} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
