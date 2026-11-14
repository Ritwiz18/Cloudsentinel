import React, { useState, useEffect, useCallback } from 'react';
import { apiClient, ApiError } from '../../api/client';
import type { DashboardOverview, SecurityAlert, SecurityIncident } from '../../types/api';
// SecurityIncident is used in derivePostureChecks' signature below.
import { ErrorState, LoadingState, EmptyState } from '../common/StateView';
import { SeverityBadge } from '../common/SeverityBadge';
import { RefreshCw, Shield, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

/**
 * Cloud Security Posture Management (CSPM) View
 * Shows posture score, misconfiguration alerts, and compliance-style checks.
 */

interface PostureCheck {
  id: string;
  name: string;
  description: string;
  status: 'PASS' | 'FAIL' | 'WARN' | 'UNKNOWN';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  detail?: string;
}

function derivePostureChecks(overview: DashboardOverview, alerts: SecurityAlert[], incidents: SecurityIncident[]): PostureCheck[] {
  const storageAlerts = alerts.filter((a) => a.rule_id.startsWith('STORAGE'));
  const iamAlerts = alerts.filter((a) => a.rule_id.startsWith('IAM'));
  const authAlerts = alerts.filter((a) => a.rule_id.startsWith('AUTH'));
  const criticalOpenAlerts = alerts.filter((a) => a.severity === 'CRITICAL' && a.status === 'OPEN');
  const openIncidentCount = incidents.filter((i) => i.status === 'OPEN').length;
  const unassignedIncidents = incidents.filter((i) => i.status === 'OPEN' && !i.assigned_analyst);

  return [
    {
      id: 'CSP-001',
      name: 'No Open Critical Alerts',
      description: 'All CRITICAL severity alerts should be investigated or resolved',
      status: criticalOpenAlerts.length === 0 ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
      detail: criticalOpenAlerts.length > 0 ? `${criticalOpenAlerts.length} critical alerts still open` : 'All clear',
    },
    {
      id: 'CSP-002',
      name: 'Storage Misconfiguration',
      description: 'No publicly accessible or unencrypted storage resources',
      status: storageAlerts.length === 0 ? 'PASS' : storageAlerts.some((a) => a.severity === 'HIGH' || a.severity === 'CRITICAL') ? 'FAIL' : 'WARN',
      severity: 'HIGH',
      detail: storageAlerts.length > 0 ? `${storageAlerts.length} storage misconfiguration alert(s) detected` : 'No issues found',
    },
    {
      id: 'CSP-003',
      name: 'IAM Policy Compliance',
      description: 'IAM policies should follow least-privilege principles',
      status: iamAlerts.length === 0 ? 'PASS' : iamAlerts.some((a) => a.severity === 'CRITICAL') ? 'FAIL' : 'WARN',
      severity: 'HIGH',
      detail: iamAlerts.length > 0 ? `${iamAlerts.length} IAM risk alert(s) found` : 'IAM policies appear compliant',
    },
    {
      id: 'CSP-004',
      name: 'Authentication Brute Force',
      description: 'No repeated authentication failures indicating brute force',
      status: authAlerts.length === 0 ? 'PASS' : authAlerts.some((a) => a.severity === 'HIGH' || a.severity === 'CRITICAL') ? 'FAIL' : 'WARN',
      severity: 'MEDIUM',
      detail: authAlerts.length > 0 ? `${authAlerts.length} auth-failure pattern(s) detected` : 'No abnormal auth patterns',
    },
    {
      id: 'CSP-005',
      name: 'Incident Response SLA',
      description: 'All open incidents should be assigned to an analyst',
      status: unassignedIncidents.length === 0 ? 'PASS' : 'WARN',
      severity: 'MEDIUM',
      detail: unassignedIncidents.length > 0
        ? `${unassignedIncidents.length} open incident(s) without an assigned analyst`
        : openIncidentCount > 0
        ? `${openIncidentCount} open incident(s), all assigned`
        : 'No open incidents',
    },
    {
      id: 'CSP-006',
      name: 'Security Posture Score',
      description: 'Overall posture score should be ≥ 80 (grade B or above)',
      status: overview.security_posture_score >= 80 ? 'PASS' : overview.security_posture_score >= 60 ? 'WARN' : 'FAIL',
      severity: 'HIGH',
      detail: `Current score: ${overview.security_posture_score}/100 (Grade ${overview.posture_grade})`,
    },
  ];
}

function CheckRow({ check }: { check: PostureCheck }) {
  const icon =
    check.status === 'PASS' ? <CheckCircle2 size={18} color="#10b981" /> :
    check.status === 'FAIL' ? <XCircle size={18} color="#ef4444" /> :
    check.status === 'WARN' ? <AlertTriangle size={18} color="#f59e0b" /> :
    <AlertTriangle size={18} color="#64748b" />;

  const bg =
    check.status === 'PASS' ? 'rgba(16,185,129,0.06)' :
    check.status === 'FAIL' ? 'rgba(239,68,68,0.06)' :
    check.status === 'WARN' ? 'rgba(245,158,11,0.06)' : 'transparent';

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.9rem 1rem', background: bg, borderBottom: '1px solid #1e2638' }}>
      <div style={{ marginTop: 2 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#64748b' }}>{check.id}</span>
          <span style={{ color: '#f1f5f9', fontWeight: 600, fontSize: '0.85rem' }}>{check.name}</span>
          <SeverityBadge severity={check.severity} />
        </div>
        <div style={{ color: '#64748b', fontSize: '0.78rem', marginTop: '0.2rem' }}>{check.description}</div>
        {check.detail && (
          <div style={{ color: check.status === 'FAIL' ? '#fca5a5' : check.status === 'WARN' ? '#fcd34d' : '#6ee7b7', fontSize: '0.75rem', marginTop: '0.3rem' }}>
            → {check.detail}
          </div>
        )}
      </div>
    </div>
  );
}

export const CSPMView: React.FC = () => {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [checks, setChecks] = useState<PostureCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      apiClient.getDashboardOverview(),
      apiClient.getAlerts({ limit: 200 }),
      apiClient.getIncidents({ limit: 100 }),
    ])
      .then(([ov, alertsData, incidentData]) => {
        setOverview(ov);
        setChecks(derivePostureChecks(ov, alertsData.items, incidentData.items));
        setLoading(false);
      })
      .catch((e: any) => {
        setError(e instanceof ApiError ? e.message : 'Failed to load CSPM data');
        setLoading(false);
      });
  }, []);

  useEffect(() => { load(); }, [load]);

  const passing = checks.filter((c) => c.status === 'PASS').length;
  const failing = checks.filter((c) => c.status === 'FAIL').length;
  const warning = checks.filter((c) => c.status === 'WARN').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Shield size={18} /> Cloud Security Posture Management
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>
            Automated compliance checks derived from live security telemetry
          </p>
        </div>
        <button className="btn btn-secondary" onClick={load} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {!loading && overview && (
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-info">
              <div className="metric-label">Checks Passing</div>
              <div className="metric-value" style={{ color: '#10b981' }}>{passing}</div>
            </div>
            <div className="metric-icon-box"><CheckCircle2 size={22} style={{ color: '#10b981' }} /></div>
          </div>
          <div className="metric-card">
            <div className="metric-info">
              <div className="metric-label">Checks Failing</div>
              <div className="metric-value" style={{ color: '#ef4444' }}>{failing}</div>
            </div>
            <div className="metric-icon-box"><XCircle size={22} style={{ color: '#ef4444' }} /></div>
          </div>
          <div className="metric-card">
            <div className="metric-info">
              <div className="metric-label">Warnings</div>
              <div className="metric-value" style={{ color: '#f59e0b' }}>{warning}</div>
            </div>
            <div className="metric-icon-box"><AlertTriangle size={22} style={{ color: '#f59e0b' }} /></div>
          </div>
          <div className="metric-card">
            <div className="metric-info">
              <div className="metric-label">Posture Score</div>
              <div className="metric-value" style={{ color: overview.security_posture_score >= 80 ? '#10b981' : overview.security_posture_score >= 60 ? '#f59e0b' : '#ef4444' }}>
                {overview.security_posture_score}
              </div>
              <div className="metric-meta">Grade {overview.posture_grade}</div>
            </div>
            <div className="metric-icon-box"><Shield size={22} style={{ color: '#3b82f6' }} /></div>
          </div>
        </div>
      )}

      <div className="panel-card" style={{ padding: 0 }}>
        {loading ? <LoadingState message="Running posture checks..." /> :
          error ? <ErrorState message={error} onRetry={load} /> :
          checks.length === 0 ? (
            <EmptyState icon={<Shield size={36} />} message="No posture data available." />
          ) : (
            <div>
              {checks.map((check) => <CheckRow key={check.id} check={check} />)}
            </div>
          )}
      </div>
    </div>
  );
};

