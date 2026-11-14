import React, { useState, useEffect, useCallback } from 'react';
import { apiClient, ApiError } from '../../api/client';
import type { DashboardOverview, Tab } from '../../types/api';
import { ErrorState, LoadingState } from '../common/StateView';
import { SeverityBadge } from '../common/SeverityBadge';
import { StatusBadge } from '../common/StatusBadge';
import { RiskScorePill } from '../common/RiskScorePill';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Shield,
  ShieldAlert,
  TrendingUp,
  Zap,
  Eye,
} from 'lucide-react';

interface Props {
  onNavigateTab: (tab: Tab) => void;
}

function PostureRing({ score, grade }: { score: number; grade: string }) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color =
    score >= 90 ? '#10b981' : score >= 75 ? '#3b82f6' : score >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
      <svg width="110" height="110" viewBox="0 0 110 110">
        <circle cx="55" cy="55" r={radius} fill="none" stroke="#1e2638" strokeWidth="10" />
        <circle
          cx="55"
          cy="55"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 55 55)"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text x="55" y="50" textAnchor="middle" fill={color} fontSize="22" fontWeight="800" fontFamily="'JetBrains Mono', monospace">
          {score}
        </text>
        <text x="55" y="68" textAnchor="middle" fill="#94a3b8" fontSize="11">
          Grade {grade}
        </text>
      </svg>
      <span style={{ fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Posture Score
      </span>
    </div>
  );
}

function StatCard({
  label, value, icon, color, sub, 'data-testid': testId,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  sub?: string;
  'data-testid'?: string;
}) {
  return (
    <div className="metric-card" data-testid={testId}>
      <div className="metric-info">
        <div className="metric-label">{label}</div>
        <div className="metric-value" style={{ color }}>{value}</div>
        {sub && <div className="metric-meta">{sub}</div>}
      </div>
      <div className="metric-icon-box" style={{ background: `${color}18` }}>
        <span style={{ color }}>{icon}</span>
      </div>
    </div>
  );
}

function SeverityBar({ data }: { data: DashboardOverview['alerts_by_severity'] }) {
  const total = data.CRITICAL + data.HIGH + data.MEDIUM + data.LOW + data.INFORMATIONAL;
  if (total === 0) return <div style={{ color: '#64748b', fontSize: '0.85rem' }}>No alerts recorded.</div>;

  const segments = [
    { key: 'CRITICAL', color: '#ef4444', val: data.CRITICAL },
    { key: 'HIGH', color: '#f97316', val: data.HIGH },
    { key: 'MEDIUM', color: '#f59e0b', val: data.MEDIUM },
    { key: 'LOW', color: '#38bdf8', val: data.LOW },
    { key: 'INFO', color: '#64748b', val: data.INFORMATIONAL },
  ];

  return (
    <div>
      <div className="dist-bar-container">
        {segments.map(({ key, color, val }) =>
          val > 0 ? (
            <div
              key={key}
              className="dist-bar-segment"
              style={{ width: `${(val / total) * 100}%`, background: color }}
              title={`${key}: ${val}`}
            />
          ) : null
        )}
      </div>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
        {segments.map(({ key, color, val }) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: '#94a3b8' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
            {key} <strong style={{ color: '#f1f5f9' }}>{val}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export const OverviewView: React.FC<Props> = ({ onNavigateTab }) => {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);
    apiClient
      .getDashboardOverview()
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err: any) => {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('Unable to load dashboard. Ensure the backend service is running on port 8000.');
        }
        setLoading(false);
      });
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) return <LoadingState message="Loading SOC dashboard metrics..." />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;
  if (!data) return null;

  const incStatusColor = (s: string) =>
    s === 'OPEN' ? '#f59e0b' : s === 'INVESTIGATING' ? '#a855f7' : s === 'RESOLVED' ? '#10b981' : '#64748b';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }} data-testid="overview-view-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f1f5f9' }}>Security Operations Overview</h2>
          <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '0.25rem' }}>
            Real-time SOC metrics · Updated {new Date(data.generated_at).toLocaleTimeString()}
          </p>
        </div>
        <button className="btn btn-secondary" onClick={loadData} disabled={loading} aria-label="Refresh dashboard">
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {/* Key Metric Cards */}
      <div className="metrics-grid">
        <StatCard label="Security Events" value={data.total_events.toLocaleString()} icon={<Activity size={20} />} color="#06b6d4" sub={`+${data.events_last_24h} in last 24h`} data-testid="metric-events" />
        <StatCard label="Total Alerts" value={data.total_alerts.toLocaleString()} icon={<AlertTriangle size={20} />} color="#f59e0b" sub={`${data.alerts_by_status.OPEN} open`} data-testid="metric-alerts" />
        <StatCard label="Critical / High" value={`${data.alerts_by_severity.CRITICAL} / ${data.alerts_by_severity.HIGH}`} icon={<ShieldAlert size={20} />} color="#ef4444" sub={`${data.open_critical_high_alerts} open now`} data-testid="metric-critical-high" />
        <StatCard label="Open Incidents" value={data.incidents_by_status.OPEN} icon={<Zap size={20} />} color="#a855f7" sub={`${data.incidents_by_status.INVESTIGATING} investigating`} data-testid="metric-incidents" />
        <StatCard label="Resolved Incidents" value={data.incidents_by_status.RESOLVED} icon={<CheckCircle size={20} />} color="#10b981" sub="Closed incidents" data-testid="metric-resolved" />
        <StatCard label="AI Investigations" value={data.total_investigations} icon={<TrendingUp size={20} />} color="#3b82f6" sub="Reports generated" data-testid="metric-investigations" />
      </div>

      {/* Posture Score + Severity Distribution */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div className="panel-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 180 }}>
          <PostureRing score={data.security_posture_score} grade={data.posture_grade} />
        </div>
        <div className="panel-card" style={{ flex: 1, minWidth: 260 }} data-testid="severity-chart">
          <div className="panel-header">
            <div className="panel-title"><AlertTriangle size={16} /> Alert Severity Distribution</div>
            <button className="btn btn-secondary" style={{ fontSize: '0.78rem' }} onClick={() => onNavigateTab('alerts')}>
              <Eye size={12} /> View All
            </button>
          </div>
          <SeverityBar data={data.alerts_by_severity} />
          <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '0.75rem' }}>
            {(['OPEN', 'INVESTIGATING', 'RESOLVED', 'FALSE_POSITIVE'] as const).map((s) => (
              <div key={s} style={{ textAlign: 'center', padding: '0.5rem', background: '#0d1117', borderRadius: 6 }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: incStatusColor(s) }}>
                  {data.alerts_by_status[s]}
                </div>
                <div style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase' }}>{s.replace('_', ' ')}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity Feeds */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {/* Recent Alerts */}
        <div className="panel-card" data-testid="recent-alerts-card">
          <div className="panel-header">
            <div className="panel-title"><Shield size={16} /> Recent Alerts</div>
            <button className="btn btn-secondary" style={{ fontSize: '0.78rem' }} onClick={() => onNavigateTab('alerts')}>View All</button>
          </div>
          {data.recent_alerts.length === 0 ? (
            <div className="state-box"><AlertTriangle size={28} /><span>No alerts yet</span></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {data.recent_alerts.slice(0, 6).map((a) => (
                <div key={a.alert_id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem', background: '#0d1117', borderRadius: 6, border: '1px solid #1e2638' }}>
                  <SeverityBadge severity={a.severity} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', color: '#f1f5f9', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{a.rule_name} · {a.occurrence_count}× seen</div>
                  </div>
                  <RiskScorePill score={a.risk_score} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Incidents */}
        <div className="panel-card" data-testid="recent-incidents-card">
          <div className="panel-header">
            <div className="panel-title"><ShieldAlert size={16} /> Recent Incidents</div>
            <button className="btn btn-secondary" style={{ fontSize: '0.78rem' }} onClick={() => onNavigateTab('incidents')}>View All</button>
          </div>
          {data.recent_incidents.length === 0 ? (
            <div className="state-box"><ShieldAlert size={28} /><span>No incidents yet</span></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {data.recent_incidents.slice(0, 6).map((inc) => (
                <div key={inc.incident_id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem', background: '#0d1117', borderRadius: 6, border: '1px solid #1e2638' }}>
                  <StatusBadge status={inc.status} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', color: '#f1f5f9', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inc.title}</div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      {inc.assigned_analyst ? `Analyst: ${inc.assigned_analyst}` : 'Unassigned'}
                    </div>
                  </div>
                  <SeverityBadge severity={inc.severity} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Events */}
        <div className="panel-card">
          <div className="panel-header">
            <div className="panel-title"><Activity size={16} /> Recent Events</div>
            <button className="btn btn-secondary" style={{ fontSize: '0.78rem' }} onClick={() => onNavigateTab('events')}>View All</button>
          </div>
          {data.recent_events.length === 0 ? (
            <div className="state-box"><Activity size={28} /><span>No events ingested yet</span></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {data.recent_events.slice(0, 7).map((e) => (
                <div key={e.event_id} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.5rem 0.65rem', background: '#0d1117', borderRadius: 6, border: '1px solid #1e2638' }}>
                  <span className={`badge-outcome ${e.outcome.toUpperCase()}`}>{e.outcome}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8rem', color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.event_type}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{e.source}{e.actor ? ` · ${e.actor}` : ''}{e.region ? ` · ${e.region}` : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
