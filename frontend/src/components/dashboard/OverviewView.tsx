import React, { useState, useEffect, useCallback } from 'react';
import type { Tab, DashboardOverview } from './types/api';
import { apiClient, ApiError } from '../../api/client';
import { LoadingState, ErrorState } from '../common/StateView';
import { SeverityBadge } from '../common/SeverityBadge';
import { StatusBadge } from '../common/StatusBadge';
import { RiskScorePill } from '../common/RiskScorePill';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Clock,
  ChevronRight,
  Eye,
  FileCode,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Server,
  Zap,
} from 'lucide-react';

interface Props {
  onNavigateTab: (tab: Tab) => void;
}

const PERIOD_OPTIONS = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: 'custom', label: 'Custom' },
  { value: 'all', label: 'All time' },
];

export const OverviewView: React.FC<Props> = ({ onNavigateTab }) => {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePeriod, setActivePeriod] = useState<string>('24h');

  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);

    Promise.all([
      apiClient
        .getDashboardOverview({
          period: activePeriod,
          start_date: undefined,
          end_date: undefined,
        })
        .catch(() => null),
      typeof apiClient.getDetectionRules === 'function'
        ? apiClient.getDetectionRules().catch(() => ({ rules: [], total: 0 }))
        : Promise.resolve({ rules: [], total: 0 }),
    ])
      .then(([overview, rulesRes]) => {
        setData(overview);
        setLoading(false);
      })
      .catch((err: any) => {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('Unable to load Command Center metrics. Ensure backend is running on port 8000.');
        }
        setLoading(false);
      });
  }, [activePeriod]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) return <LoadingState message="Loading Command Center telemetry & posture from database..." />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;
  if (!data) return null;

  const totalAlertsCount =
    data.alerts_by_severity.CRITICAL +
    data.alerts_by_severity.HIGH +
    data.alerts_by_severity.MEDIUM +
    data.alerts_by_severity.LOW +
    data.alerts_by_severity.INFORMATIONAL;

  const severityConfigs = [
    { key: 'CRITICAL', label: 'Critical', color: '#ef4444', count: data.alerts_by_severity.CRITICAL },
    { key: 'HIGH', label: 'High', color: '#f97316', count: data.alerts_by_severity.HIGH },
    { key: 'MEDIUM', label: 'Medium', color: '#eab308', count: data.alerts_by_severity.MEDIUM },
    { key: 'LOW', label: 'Low', color: '#10b981', count: data.alerts_by_severity.LOW },
    { key: 'INFO', label: 'Info', color: '#64748b', count: data.alerts_by_severity.INFORMATIONAL },
  ];

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference - (data.security_posture_score / 100) * circumference;
  const postureColor =
    data.security_posture_score >= 80
      ? '#10b981'
      : data.security_posture_score >= 60
      ? '#38bdf8'
      : data.security_posture_score >= 40
      ? '#eab308'
      : '#ef4444';

  // Source-aware status: distinguish real AWS events from simulator-only activity
  const hasAwsEvents = (data.sources_seen['aws.cloudtrail'] || 0) > 0;
  const hasSimOnly =
    (data.sources_seen['simulator'] || 0) > 0 && !hasAwsEvents;

  const socLabel = hasAwsEvents
    ? 'Real-Time Telemetry'
    : hasSimOnly
      ? 'Synthetic Security Event Stream'
      : 'No Active Events';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} data-testid="overview-view-container">
      {/* 1. Command Center Hero Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          padding: '1.25rem 1.5rem',
          background: 'linear-gradient(180deg, #0f172a 0%, #0a0f1d 100%)',
          borderRadius: 8,
          border: '1px solid #1e293b',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 8,
              background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(2, 132, 199, 0.25) 100%)',
              border: '1px solid rgba(6, 182, 212, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#06b6d4',
            }}
          >
            <Shield size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.02em', margin: 0 }}>
                Security Operations Command Center
              </h2>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '9999px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  background: 'rgba(16, 185, 129, 0.1)',
                  color: '#10b981',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                {socLabel}
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0.25rem 0 0' }}>
              Centralized AWS CloudTrail & simulation stream evaluation, deterministic rule analytics, and correlated incident response.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ fontSize: '0.74rem', color: '#64748b', textAlign: 'right' }}>
            <div>Last Polled</div>
            <div style={{ color: '#f1f5f9', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
              {new Date(data.generated_at).toLocaleTimeString()}
            </div>
          </div>
          <button
            className="btn btn-secondary"
            onClick={loadData}
            disabled={loading}
            aria-label="Refresh dashboard"
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.78rem' }}
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Period filter selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.74rem', color: '#64748b' }}>Window:</div>
          <select
            className="select-field"
            value={activePeriod}
            onChange={(e) => {
              setActivePeriod(e.target.value);
              loadData();
            }}
            style={{ padding: '0.35rem 0.65rem', fontSize: '0.72rem' }}
          >
            {PERIOD_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. Key Operational Metrics Grid (Six Primary Security KPI Cards) */}
      <div className="metrics-grid">
        {/* KPI 1: Ingested Events */}
        <div className="metric-card" data-testid="metric-events">
          <div className="metric-info">
            <span className="metric-label">Processed Events</span>
            <span className="metric-value" style={{ color: '#38bdf8' }}>
              {data.total_events.toLocaleString()}
            </span>
            <span className="metric-meta">
              +{data.events_last_24h} in 24h · Multi-source intake
            </span>
          </div>
          <div className="metric-icon-box" style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8' }}>
            <Activity size={22} />
          </div>
        </div>

        {/* KPI 2: Active Security Alerts */}
        <div className="metric-card" data-testid="metric-alerts">
          <div className="metric-info">
            <span className="metric-label">Active Alerts</span>
            <span className="metric-value" style={{ color: data.alerts_by_status.OPEN > 0 ? '#f59e0b' : '#10b981' }}>
              {data.total_alerts.toLocaleString()}
            </span>
            <span className="metric-meta">
              {data.alerts_by_status.OPEN} open in triage queue
            </span>
          </div>
          <div className="metric-icon-box" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
            <AlertTriangle size={22} />
          </div>
        </div>

        {/* KPI 3: Critical & High Threats */}
        <div className="metric-card" data-testid="metric-critical-high">
          <div className="metric-info">
            <span className="metric-label">Critical & High Threats</span>
            <span className="metric-value" style={{ color: data.critical_high_alerts > 0 ? '#ef4444' : '#64748b' }}>
              {data.critical_high_alerts.toLocaleString()}
            </span>
            <span className="metric-meta">
              {data.open_critical_high_alerts} active priority findings
            </span>
          </div>
          <div className="metric-icon-box" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
            <ShieldAlert size={22} />
          </div>
        </div>

        {/* KPI 4: Correlated Incidents */}
        <div className="metric-card" data-testid="metric-incidents">
          <div className="metric-info">
            <span className="metric-label">Open Incidents</span>
            <span className="metric-value" style={{ color: data.incidents_by_status.OPEN > 0 ? '#a855f7' : '#10b981' }}>
              {data.incidents_by_status.OPEN.toLocaleString()}
            </span>
            <span className="metric-meta">
              {data.incidents_by_status.INVESTIGATING} investigating · {data.total_incidents} total
            </span>
          </div>
          <div className="metric-icon-box" style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7' }}>
            <Zap size={22} />
          </div>
        </div>

        {/* KPI 5: Remediated Incidents */}
        <div className="metric-card" data-testid="metric-resolved">
          <div className="metric-info">
            <span className="metric-label">Remediated Incidents</span>
            <span className="metric-value" style={{ color: '#10b981' }}>
              {data.incidents_by_status.RESOLVED.toLocaleString()}
            </span>
            <span className="metric-meta">
              {data.total_incidents > 0
                ? `${Math.round((data.incidents_by_status.RESOLVED / data.total_incidents) * 100)}% resolution rate`
                : 'Zero open breaches'}
            </span>
          </div>
          <div className="metric-icon-box" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
            <ShieldCheck size={22} />
          </div>
        </div>

        {/* KPI 6: Active Detection Rules */}
        <div className="metric-card" data-testid="metric-rules">
          <div className="metric-info">
            <span className="metric-label">Detection Rules</span>
            <span className="metric-value" style={{ color: '#06b6d4' }}>
              {data.posture_by_domain.length > 0 ? data.posture_by_domain.length : 4}
            </span>
            <span className="metric-meta">
              {data.posture_by_domain.length} active rule families loaded
            </span>
          </div>
          <div className="metric-icon-box" style={{ background: 'rgba(6, 182, 212, 0.1)', color: '#06b6d4' }}>
            <FileCode size={22} />
          </div>
        </div>
      </div>

      {/* 3. Security Posture Summary & Domain Panel Section */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem', flexWrap: 'wrap' }}>
        {/* Posture Score Summary Card */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '1.5rem',
            background: '#0a0f1d',
            border: '1px solid #1e293b',
          }}
        >
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.9rem', color: '#f1f5f9' }}>
              <ShieldCheck size={18} style={{ color: postureColor }} />
              Security Posture Score
            </div>
            <span
              style={{
                fontSize: '0.72rem',
                padding: '0.2rem 0.5rem',
                borderRadius: 4,
                background: `${postureColor}20`,
                color: postureColor,
                fontWeight: 700,
              }}
            >
              Grade {data.posture_grade}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '0.75rem 0' }}>
            <svg width="140" height="140" viewBox="0 0 140 140">
              <circle cx="70" cy="70" r={radius} fill="none" stroke="#131d35" strokeWidth="12" />
              <circle
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke={postureColor}
                strokeWidth="12"
                strokeDasharray={circumference}
                strokeDashoffset={strokeOffset}
                strokeLinecap="round"
                transform="rotate(-90 70 70)"
                style={{ transition: 'stroke-dashoffset 0.8s ease' }}
              />
              <text
                x="70"
                y="66"
                textAnchor="middle"
                fill={postureColor}
                fontSize="32"
                fontWeight="800"
                fontFamily="'JetBrains Mono', monospace"
              >
                {data.security_posture_score}
              </text>
              <text x="70" y="86" textAnchor="middle" fill="#94a3b8" fontSize="12" fontWeight="600">
                / 100
              </text>
            </svg>
            <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f1f5f9' }}>
                {data.security_posture_score < 40
                  ? 'Urgent Remediations Needed'
                  : data.security_posture_score < 70
                  ? 'Elevated Risk Level'
                  : 'Robust Security Posture'}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.15rem' }}>
                Deterministic penalty index
              </div>
            </div>
          </div>

          <div
            style={{
              paddingTop: '0.85rem',
              borderTop: '1px solid #1e293b',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
              fontSize: '0.74rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
              <span>Open Critical Threats</span>
              <strong style={{ color: data.alerts_by_severity.CRITICAL > 0 ? '#ef4444' : '#10b981' }}>
                {data.alerts_by_severity.CRITICAL} (-{data.alerts_by_severity.CRITICAL * 10} pts)
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
              <span>Open High Threats</span>
              <strong style={{ color: data.alerts_by_severity.HIGH > 0 ? '#f97316' : '#10b981' }}>
                {data.alerts_by_severity.HIGH} (-{data.alerts_by_severity.HIGH * 5} pts)
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
              <span>Unresolved Incident Penalty</span>
              <strong style={{ color: '#f59e0b' }}>
                {data.incidents_by_status.OPEN + data.incidents_by_status.INVESTIGATING} active
              </strong>
            </div>
          </div>
        </div>

        {/* Domain Posture Panel */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '1.5rem',
            background: '#0a0f1d',
            border: '1px solid #1e293b',
          }}
        >
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.95rem', color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={18} style={{ color: '#06b6d4' }} /> Per-Domain Posture
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
              Scores derived from implemented detection rules only; domains without checks are marked not_implemented
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            {data.posture_by_domain.map((domain) => (
              <div
                key={domain.domain}
                style={{ padding: '0.75rem', background: '#060913', borderRadius: 6, border: '1px solid #1e293b' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f1f5f9' }}>{domain.domain}</div>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Checks: {domain.checks_run}</div>
                  </div>
                  <span
                    style={{
                      padding: '0.2rem 0.5rem',
                      borderRadius: 4,
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      background: domain.status === 'healthy' ? 'rgba(16,185,129,0.2)' : domain.status === 'degraded' ? 'rgba(245,158,11,0.2)' : domain.status === 'critical' ? 'rgba(239,68,68,0.2)' : 'rgba(100,116,139,0.2)',
                      color: domain.status === 'healthy' ? '#10b981' : domain.status === 'degraded' ? '#f59e0b' : domain.status === 'critical' ? '#ef4444' : '#94a3b8',
                    }}
                  >
                    {domain.status === 'healthy' ? 'Healthy' : domain.status === 'degraded' ? 'Degraded' : domain.status === 'critical' ? 'Critical' : 'Not Implemented'}
                  </span>
                </div>
                {domain.score !== null && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <div style={{ width: 100, height: 6, borderRadius: 3, background: domain.status === 'healthy' ? '#10b981' : domain.status === 'degraded' ? '#f59e0b' : '#ef4444' }} />
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#f1f5f9' }}>{domain.score}</div>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', fontFamily: "'JetBrains Mono', monospace" }}>/ 100</div>
                  </div>
                )}
                <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 500 }}>{domain.rationale}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Priority Alert Queue */}
      <div className="panel-card" data-testid="recent-alerts-card" style={{ padding: '1.5rem', background: '#0a0f1d', border: '1px solid #1e293b' }}>
        <div style={{ marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '1.05rem', color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldAlert size={18} style={{ color: '#ef4444' }} />
              Priority Security Alert Queue
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.15rem' }}>
              Actionable threat detections generated by deterministic rule signatures
            </div>
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => onNavigateTab('alerts')}
            style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
          >
            <Eye size={13} /> View All Alerts
            <ArrowRight size={13} />
          </button>
        </div>

        {data.recent_alerts.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <ShieldCheck size={32} style={{ color: '#10b981', margin: '0 auto 0.5rem' }} />
            <div style={{ fontSize: '0.9rem', color: '#f1f5f9', fontWeight: 600 }}>No Alerts Found</div>
            <p style={{ color: '#64748b', fontSize: '0.78rem', margin: '0.25rem 0 0' }}>
              No alerts match the selected window.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1e293b', color: '#64748b', textAlign: 'left', background: '#060913' }}>
                  <th style={{ padding: '0.75rem 0.85rem', width: 110 }}>Severity</th>
                  <th style={{ padding: '0.75rem 0.85rem' }}>Alert Title & Finding</th>
                  <th style={{ padding: '0.75rem 0.85rem' }}>Triggering Signature</th>
                  <th style={{ padding: '0.75rem 0.85rem', width: 90 }}>Risk Score</th>
                  <th style={{ padding: '0.75rem 0.85rem', width: 85 }}>Count</th>
                  <th style={{ padding: '0.75rem 0.85rem', width: 140 }}>Detected</th>
                  <th style={{ padding: '0.75rem 0.85rem', textAlign: 'right', width: 90 }}>Triage</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_alerts.slice(0, 6).map((alert) => (
                  <tr
                    key={alert.alert_id}
                    style={{ borderBottom: '1px solid #1e293b', transition: 'background-color 0.15s ease', cursor: 'pointer' }}
                    onClick={() => onNavigateTab('alerts')}
                  >
                    <td style={{ padding: '0.75rem 0.85rem' }}>
                      <SeverityBadge severity={alert.severity} />
                    </td>
                    <td style={{ padding: '0.75rem 0.85rem' }}>
                      <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{alert.title}</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: "'JetBrains Mono', monospace", marginTop: '0.15rem' }}>
                        ID: {alert.alert_id} · Status: {alert.status}
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 0.85rem' }}>
                      <span
                        style={{
                          padding: '0.2rem 0.5rem',
                          background: '#060913',
                          border: '1px solid #1e293b',
                          borderRadius: 4,
                          fontSize: '0.72rem',
                          color: '#38bdf8',
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      >
                        {alert.rule_name}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 0.85rem' }}>
                      <RiskScorePill score={alert.risk_score} />
                    </td>
                    <td style={{ padding: '0.75rem 0.85rem', color: '#94a3b8' }}>
                      <span style={{ fontWeight: 600, color: '#f1f5f9' }}>{alert.occurrence_count}×</span>
                    </td>
                    <td style={{ padding: '0.75rem 0.85rem', color: '#64748b', fontSize: '0.74rem' }}>
                      {new Date(alert.first_seen).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                      {new Date(alert.first_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '0.75rem 0.85rem', textAlign: 'right' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: '0.72rem', padding: '0.25rem 0.55rem' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateTab('alerts');
                        }}
                      >
                        Triage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Security Activity Timeline */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.5rem' }}>
        {/* Recent Incident Activity */}
        <div
          className="panel-card"
          data-testid="recent-incidents-card"
          style={{ padding: '1.5rem', background: '#0a0f1d', border: '1px solid #1e293b' }}
        >
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.95rem', color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Zap size={17} style={{ color: '#a855f7' }} /> Correlated Incident Activity
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.15rem' }}>
              Automated multi-alert attack clustering
            </div>
          </div>
          <button
            className="btn btn-secondary"
            style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
            onClick={() => onNavigateTab('incidents')}
          >
            <span>Response</span>
            <ArrowRight size={13} />
          </button>

          {data.recent_incidents.length === 0 ? (
            <div style={{ padding: '1.75rem', textAlign: 'center' }}>
              <p style={{ color: '#64748b', fontSize: '0.82rem' }}>No correlated security incidents recorded.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {data.recent_incidents.slice(0, 4).map((inc) => (
                <div
                  key={inc.incident_id}
                  onClick={() => onNavigateTab('incidents')}
                  style={{
                    padding: '0.85rem',
                    background: '#060913',
                    borderRadius: 6,
                    border: '1px solid #1e293b',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s, background-color 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#0f172a';
                    e.currentTarget.style.borderColor = '#06b6d440';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#060913';
                    e.currentTarget.style.borderColor = '#1e293b';
                  }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <SeverityBadge severity={inc.severity} showIcon={false} />
                        <span style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: "'JetBrains Mono', monospace" }}>{inc.incident_id}</span>
                      </div>
                      <StatusBadge status={inc.status} />
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '0.84rem', color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {inc.title}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', fontSize: '0.72rem', color: '#64748b' }}>
                      <span>
                        Analyst: <strong style={{ color: inc.assigned_analyst ? '#06b6d4' : '#94a3b8' }}>{inc.assigned_analyst || 'Unassigned'}</strong>
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Clock size={12} />
                        {new Date(inc.first_seen).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>

        {/* Event Activity Timeline Feed */}
        <div className="panel-card" style={{ padding: '1.5rem', background: '#0a0f1d', border: '1px solid #1e293b' }}>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.95rem', color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={17} style={{ color: '#38bdf8' }} /> Event Activity Timeline
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.15rem' }}>
              Normalized security events in chronological stream
            </div>
          </div>
          <button
            className="btn btn-secondary"
            style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
            onClick={() => onNavigateTab('events')}
          >
            <span>Event Explorer</span>
            <ArrowRight size={13} />
          </button>

          {data.recent_events.length === 0 ? (
            <div style={{ padding: '1.75rem', textAlign: 'center' }}>
              <p style={{ color: '#64748b', fontSize: '0.82rem' }}>No events recorded in telemetry intake.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              {data.recent_events.slice(0, 5).map((e) => (
                <div
                  key={e.event_id}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 0.75rem', background: '#060913', borderRadius: 6, border: '1px solid #1e293b' }}
                >
                  <span
                    className={`badge-outcome ${e.outcome.toUpperCase()}`}
                    style={{ fontSize: '0.68rem', padding: '0.2rem 0.45rem', borderRadius: 4, fontWeight: 600, textTransform: 'uppercase' }}
                  >
                    {e.outcome}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8rem', color: '#f1f5f9', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.event_type}</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.source}{e.actor ? ` · ${e.actor}` : ''}{e.region ? ` · ${e.region}` : ''}</div>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: "'JetBrains Mono', monospace" }}>{new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 6. Detection Rule Activity & Health Indicators Footer */}
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', padding: '1.25rem', background: '#0a0f1d', borderRadius: 8, border: '1px solid #1e293b' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: 6, background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
            <ShieldCheck size={18} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f1f5f9' }}>Detection Rule Engine</div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
              {data.posture_by_domain.length > 0 ? `${data.posture_by_domain.length} active rule families` : 'Deterministic Signatures Active'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: 6, background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
            <Server size={18} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f1f5f9' }}>API & Ingestion Gateway</div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>FastAPI Async Service</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: 6, background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a855f7' }}>
            <Database size={18} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f1f5f9' }}>Database Engine</div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>PostgreSQL 16 Engine</div>
          </div>
        </div>
      </div>
    </div>
  );
};