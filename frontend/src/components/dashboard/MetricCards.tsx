import React from 'react';
import { Activity, AlertOctagon, AlertTriangle, ShieldCheck } from 'lucide-react';

interface Props {
  totalEvents: number;
  openIncidents: number;
  openAlerts: number;
  criticalHighAlerts: number;
}

export const MetricCards: React.FC<Props> = ({
  totalEvents,
  openIncidents,
  openAlerts,
  criticalHighAlerts,
}) => {
  return (
    <div className="metrics-grid">
      <div className="metric-card" data-testid="metric-events">
        <div className="metric-info">
          <span className="metric-label">Security Events</span>
          <span className="metric-value">{totalEvents.toLocaleString()}</span>
          <span className="metric-meta">Ingested & normalized telemetry</span>
        </div>
        <div className="metric-icon-box" style={{ color: '#06b6d4' }}>
          <Activity size={22} />
        </div>
      </div>

      <div className="metric-card" data-testid="metric-incidents">
        <div className="metric-info">
          <span className="metric-label">Open Incidents</span>
          <span className="metric-value" style={{ color: openIncidents > 0 ? '#fbbf24' : '#10b981' }}>
            {openIncidents.toLocaleString()}
          </span>
          <span className="metric-meta">Active correlation clusters</span>
        </div>
        <div className="metric-icon-box" style={{ color: '#f59e0b' }}>
          <ShieldCheck size={22} />
        </div>
      </div>

      <div className="metric-card" data-testid="metric-alerts">
        <div className="metric-info">
          <span className="metric-label">Open Alerts</span>
          <span className="metric-value" style={{ color: openAlerts > 0 ? '#fb923c' : '#10b981' }}>
            {openAlerts.toLocaleString()}
          </span>
          <span className="metric-meta">Pending triage / investigation</span>
        </div>
        <div className="metric-icon-box" style={{ color: '#f97316' }}>
          <AlertTriangle size={22} />
        </div>
      </div>

      <div className="metric-card" data-testid="metric-critical-high">
        <div className="metric-info">
          <span className="metric-label">Critical & High</span>
          <span className="metric-value" style={{ color: criticalHighAlerts > 0 ? '#f87171' : '#94a3b8' }}>
            {criticalHighAlerts.toLocaleString()}
          </span>
          <span className="metric-meta">High priority security threats</span>
        </div>
        <div className="metric-icon-box" style={{ color: '#ef4444' }}>
          <AlertOctagon size={22} />
        </div>
      </div>
    </div>
  );
};
