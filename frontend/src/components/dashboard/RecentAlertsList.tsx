import React from 'react';
import { ArrowRight, Shield } from 'lucide-react';
import type { DashboardRecentAlert } from '../../types/api';
import { SeverityBadge } from '../common/SeverityBadge';
import { RiskScorePill } from '../common/RiskScorePill';

export interface RecentAlertsListProps {
  alerts: DashboardRecentAlert[];
  onViewAll?: () => void;
  onSelectAlert?: (alert: DashboardRecentAlert) => void;
}

export const RecentAlertsList: React.FC<RecentAlertsListProps> = ({
  alerts,
  onViewAll,
  onSelectAlert,
}) => {
  return (
    <div className="panel-card" style={{ flex: 1, minWidth: 280 }} data-testid="recent-alerts-card">
      <div className="panel-header">
        <div className="panel-title">
          <Shield size={16} /> Recent Alerts
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

      {alerts.length === 0 ? (
        <div className="state-box" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No recent security alerts recorded.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {alerts.slice(0, 6).map((alert) => (
            <div
              key={alert.alert_id}
              onClick={() => onSelectAlert?.(alert)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.65rem 0.75rem',
                borderRadius: '6px',
                backgroundColor: '#0a101d',
                border: '1px solid #162235',
                cursor: onSelectAlert ? 'pointer' : 'default',
                transition: 'background-color 0.15s ease, border-color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (onSelectAlert) {
                  e.currentTarget.style.backgroundColor = '#111b2b';
                  e.currentTarget.style.borderColor = '#19d3d040';
                }
              }}
              onMouseLeave={(e) => {
                if (onSelectAlert) {
                  e.currentTarget.style.backgroundColor = '#0a101d';
                  e.currentTarget.style.borderColor = '#162235';
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
                <SeverityBadge severity={alert.severity} showIcon={false} />
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {alert.title}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                    <span className="font-mono">{alert.rule_name}</span> · {alert.occurrence_count}× seen
                  </div>
                </div>
              </div>
              <div style={{ marginLeft: '0.75rem', flexShrink: 0 }}>
                <RiskScorePill score={alert.risk_score} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
