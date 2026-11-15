import React from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  CheckCircle,
  FileSearch,
  ShieldAlert,
} from 'lucide-react';

export interface MetricCardsProps {
  totalEvents: number;
  openIncidents: number;
  openAlerts: number;
  criticalHighAlerts: number;
  resolvedIncidents?: number;
  totalInvestigations?: number;
  eventsLast24h?: number;
  openCriticalHighAlerts?: number;
}

export const MetricCards: React.FC<MetricCardsProps> = ({
  totalEvents,
  openIncidents,
  openAlerts,
  criticalHighAlerts,
  resolvedIncidents = 0,
  totalInvestigations = 0,
  eventsLast24h = 0,
  openCriticalHighAlerts,
}) => {
  return (
    <div className="metrics-grid">
      {/* 1. Monitored Events */}
      <div className="metric-card" data-testid="metric-events">
        <div className="metric-info">
          <span className="metric-label">Security Events</span>
          <span className="metric-value" style={{ color: '#38bdf8' }}>
            {totalEvents.toLocaleString()}
          </span>
          <span className="metric-meta">
            {eventsLast24h > 0 ? `+${eventsLast24h} in last 24h` : 'Normalized telemetry'}
          </span>
        </div>
        <div className="metric-icon-box" style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8' }}>
          <Activity size={20} />
        </div>
      </div>

      {/* 2. Open Alerts */}
      <div className="metric-card" data-testid="metric-alerts">
        <div className="metric-info">
          <span className="metric-label">Open Alerts</span>
          <span className="metric-value" style={{ color: openAlerts > 0 ? '#f59e0b' : '#22c55e' }}>
            {openAlerts.toLocaleString()}
          </span>
          <span className="metric-meta">Pending SOC triage</span>
        </div>
        <div className="metric-icon-box" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
          <AlertTriangle size={20} />
        </div>
      </div>

      {/* 3. Critical & High Threats */}
      <div className="metric-card" data-testid="metric-critical-high">
        <div className="metric-info">
          <span className="metric-label">Critical & High</span>
          <span className="metric-value" style={{ color: criticalHighAlerts > 0 ? '#ef4444' : '#64748b' }}>
            {criticalHighAlerts.toLocaleString()}
          </span>
          <span className="metric-meta">
            {openCriticalHighAlerts !== undefined
              ? `${openCriticalHighAlerts} active threats`
              : 'Priority security findings'}
          </span>
        </div>
        <div className="metric-icon-box" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
          <ShieldAlert size={20} />
        </div>
      </div>

      {/* 4. Open Incidents */}
      <div className="metric-card" data-testid="metric-incidents">
        <div className="metric-info">
          <span className="metric-label">Open Incidents</span>
          <span className="metric-value" style={{ color: openIncidents > 0 ? '#a855f7' : '#22c55e' }}>
            {openIncidents.toLocaleString()}
          </span>
          <span className="metric-meta">Correlated threat clusters</span>
        </div>
        <div className="metric-icon-box" style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7' }}>
          <AlertOctagon size={20} />
        </div>
      </div>

      {/* 5. Resolved Incidents */}
      <div className="metric-card" data-testid="metric-resolved">
        <div className="metric-info">
          <span className="metric-label">Resolved Incidents</span>
          <span className="metric-value" style={{ color: '#22c55e' }}>
            {resolvedIncidents.toLocaleString()}
          </span>
          <span className="metric-meta">Remediated & closed</span>
        </div>
        <div className="metric-icon-box" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e' }}>
          <CheckCircle size={20} />
        </div>
      </div>

      {/* 6. AI Investigations */}
      <div className="metric-card" data-testid="metric-investigations">
        <div className="metric-info">
          <span className="metric-label">AI Investigations</span>
          <span className="metric-value" style={{ color: '#19d3d0' }}>
            {totalInvestigations.toLocaleString()}
          </span>
          <span className="metric-meta">Heuristic root-cause reports</span>
        </div>
        <div className="metric-icon-box" style={{ background: 'rgba(25, 211, 208, 0.1)', color: '#19d3d0' }}>
          <FileSearch size={20} />
        </div>
      </div>
    </div>
  );
};
