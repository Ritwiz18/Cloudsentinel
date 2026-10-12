import React from 'react';
import { ArrowRight } from 'lucide-react';
import type { SecurityAlert } from '../../types/api';
import { SeverityBadge } from '../common/SeverityBadge';
import { RiskScorePill } from '../common/RiskScorePill';

interface Props {
  alerts: SecurityAlert[];
  onSelectAlert: (alert: SecurityAlert) => void;
  onViewAll: () => void;
}

export const RecentAlertsList: React.FC<Props> = ({ alerts, onSelectAlert, onViewAll }) => {
  return (
    <div className="panel-card" style={{ flex: 1 }} data-testid="recent-alerts-card">
      <div className="panel-header">
        <h3 className="panel-title">Recent Security Alerts</h3>
        <button
          className="btn btn-secondary"
          onClick={onViewAll}
          style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
        >
          View All <ArrowRight size={13} />
        </button>
      </div>

      {alerts.length === 0 ? (
        <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No recent security alerts recorded.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {alerts.slice(0, 5).map((alert) => (
            <div
              key={alert.alert_id}
              onClick={() => onSelectAlert(alert)}
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
                <SeverityBadge severity={alert.severity} showIcon={false} />
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#f1f5f9' }}>
                    {alert.title}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                    Rule: <span className="font-mono">{alert.rule_id}</span> •{' '}
                    {new Date(alert.last_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
              <RiskScorePill score={alert.risk_score} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
