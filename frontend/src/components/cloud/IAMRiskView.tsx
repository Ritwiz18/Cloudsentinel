import React, { useState, useEffect, useCallback } from 'react';
import { apiClient, ApiError } from '../../api/client';
import type { DetectionRule, SecurityAlert } from '../../types/api';
import { ErrorState, LoadingState, EmptyState } from '../common/StateView';
import { SeverityBadge } from '../common/SeverityBadge';
import { StatusBadge } from '../common/StatusBadge';
import { RiskScorePill } from '../common/RiskScorePill';
import { Pagination } from '../common/Pagination';
import { RefreshCw, User, AlertTriangle } from 'lucide-react';

/**
 * IAM Risk Analysis View — filters alerts by IAM/storage-related rule IDs
 * (IAM-*, STORAGE-*) to highlight privilege escalation, policy
 * misconfigurations, etc. Rule list comes from the real detection engine.
 */
export const IAMRiskView: React.FC = () => {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [filterRule, setFilterRule] = useState('');
  const [iamRules, setIamRules] = useState<DetectionRule[]>([]);
  const limit = 20;

  // IAM/storage rule list comes from the real detection engine
  // (GET /api/v1/detections/rules) instead of a hardcoded fabricated list.
  useEffect(() => {
    if (typeof apiClient.getDetectionRules !== 'function') return;
    apiClient
      .getDetectionRules()
      .then((r) => setIamRules(r.rules.filter((x) => x.rule_id.startsWith('IAM') || x.rule_id.startsWith('STORAGE'))))
      .catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    // Load all IAM/Storage related alerts by fetching broadly and filtering
    apiClient.getAlerts({ limit: 100, offset: 0 })
      .then((r) => {
        const knownIds = new Set(iamRules.map((x) => x.rule_id));
        const isIamStorageRule = (id: string) =>
          knownIds.has(id) || id.startsWith('IAM') || id.startsWith('STORAGE');
        const iamAlerts = r.items.filter((a) => isIamStorageRule(a.rule_id));
        const filtered = filterRule ? iamAlerts.filter((a) => a.rule_id === filterRule) : iamAlerts;
        setAlerts(filtered.slice(page * limit, (page + 1) * limit));
        setTotal(filtered.length);
        setLoading(false);
      })
      .catch((e: any) => {
        setError(e instanceof ApiError ? e.message : 'Failed to load IAM risk data');
        setLoading(false);
      });
  }, [page, filterRule, iamRules]);

  useEffect(() => { load(); }, [load]);

  const ruleIds = Array.from(
    new Set([
      ...iamRules.map((r) => r.rule_id),
      ...alerts.map((a) => a.rule_id).filter((id) => id.startsWith('IAM') || id.startsWith('STORAGE')),
    ])
  );
  const ruleName = (id: string) => iamRules.find((r) => r.rule_id === id)?.rule_name || 'IAM/Storage rule';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <User size={18} /> IAM Risk Analysis
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>
            Privilege escalation, policy misconfigurations, and access anomalies
          </p>
        </div>
        <button className="btn btn-secondary" onClick={load} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {/* Rule Filter Pills */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          className={`btn ${filterRule === '' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: '0.78rem', padding: '0.3rem 0.75rem' }}
          onClick={() => { setFilterRule(''); setPage(0); }}
        >
          All IAM Rules
        </button>
        {ruleIds.map((r) => (
          <button
            key={r}
            className={`btn ${filterRule === r ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.78rem', padding: '0.3rem 0.75rem' }}
            onClick={() => { setFilterRule(r); setPage(0); }}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Rule Legend */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.65rem' }}>
        {ruleIds.map((r) => (
          <div key={r} style={{ background: '#0d1117', border: '1px solid #1e2638', borderRadius: 8, padding: '0.65rem' }}>
            <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#06b6d4', marginBottom: '0.2rem' }}>{r}</div>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{ruleName(r)}</div>
          </div>
        ))}
      </div>

      <div className="panel-card" style={{ padding: 0 }}>
        {loading ? <LoadingState message="Analyzing IAM risk data..." /> :
          error ? <ErrorState message={error} onRetry={load} /> :
          alerts.length === 0 ? (
            <EmptyState
              icon={<AlertTriangle size={36} />}
              message="No IAM risk alerts found."
              sub="Run the detection engine on events with IAM or storage event types."
            />
          ) : (
            <>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Severity</th>
                      <th>Alert</th>
                      <th>Rule</th>
                      <th>Risk Score</th>
                      <th>Status</th>
                      <th>Occurrences</th>
                      <th>Last Seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map((a) => (
                      <tr key={a.alert_id}>
                        <td><SeverityBadge severity={a.severity} /></td>
                        <td style={{ maxWidth: 300 }}>
                          <div style={{ color: '#f1f5f9', fontWeight: 500, fontSize: '0.85rem' }}>{a.title}</div>
                          <div style={{ color: '#64748b', fontSize: '0.72rem' }}>{a.alert_id.substring(0, 20)}...</div>
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#a855f7' }}>{a.rule_id}</td>
                        <td><RiskScorePill score={a.risk_score} /></td>
                        <td><StatusBadge status={a.status} /></td>
                        <td style={{ color: '#94a3b8', fontSize: '0.82rem', textAlign: 'center' }}>{a.occurrence_count}</td>
                        <td style={{ color: '#64748b', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                          {new Date(a.last_seen).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #1e2638' }}>
                <Pagination total={total} limit={limit} offset={page * limit} onPageChange={(o) => setPage(Math.floor(o / limit))} />
              </div>
            </>
          )}
      </div>
    </div>
  );
};

