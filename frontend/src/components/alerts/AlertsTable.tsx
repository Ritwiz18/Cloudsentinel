import React, { useState, useEffect, useCallback } from 'react';
import { apiClient, ApiError } from '../../api/client';
import type { SecurityAlert } from '../../types/api';
import { EmptyState, ErrorState, LoadingState } from '../common/StateView';
import { Pagination } from '../common/Pagination';
import { SeverityBadge } from '../common/SeverityBadge';
import { StatusBadge } from '../common/StatusBadge';
import { RiskScorePill } from '../common/RiskScorePill';
import { AlertDetailDrawer } from './AlertDetailDrawer';
import { AlertTriangle, Filter, RefreshCw } from 'lucide-react';

export const AlertsTable: React.FC = () => {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [total, setTotal] = useState(0);
  const [limit] = useState(15);
  const [offset, setOffset] = useState(0);

  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterRule, setFilterRule] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<SecurityAlert | null>(null);

  const executeFetch = useCallback((isMountedRef?: { current: boolean }) => {
    return apiClient
      .getAlerts({
        limit,
        offset,
        severity: filterSeverity || undefined,
        rule_id: filterRule || undefined,
        status: filterStatus || undefined,
      })
      .then((data) => {
        if (isMountedRef && !isMountedRef.current) return;
        setAlerts(data.items);
        setTotal(data.total);
        setLoading(false);
      })
      .catch((err: any) => {
        if (isMountedRef && !isMountedRef.current) return;
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('Failed to fetch security alerts. Please verify backend connection.');
        }
        setLoading(false);
      });
  }, [limit, offset, filterSeverity, filterRule, filterStatus]);

  const fetchAlerts = useCallback(() => {
    setLoading(true);
    setError(null);
    void executeFetch();
  }, [executeFetch]);

  useEffect(() => {
    const isMountedRef = { current: true };
    void executeFetch(isMountedRef);
    return () => {
      isMountedRef.current = false;
    };
  }, [executeFetch]);

  const handleResetFilters = () => {
    setFilterSeverity('');
    setFilterRule('');
    setFilterStatus('');
    setOffset(0);
  };

  return (
    <div className="panel-card" data-testid="alerts-page-container">
      <div className="panel-header">
        <h2 className="panel-title">
          <AlertTriangle size={18} /> Persistent Security Alerts
        </h2>
        <button
          className="btn btn-secondary"
          onClick={fetchAlerts}
          disabled={loading}
          aria-label="Refresh alerts"
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="toolbar-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#94a3b8', fontSize: '0.85rem' }}>
          <Filter size={14} /> Filters:
        </div>
        <select
          className="select-field"
          value={filterSeverity}
          onChange={(e) => {
            setFilterSeverity(e.target.value);
            setOffset(0);
          }}
          aria-label="Filter by severity"
        >
          <option value="">All Severities</option>
          <option value="CRITICAL">CRITICAL</option>
          <option value="HIGH">HIGH</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="LOW">LOW</option>
          <option value="INFORMATIONAL">INFORMATIONAL</option>
        </select>

        <select
          className="select-field"
          value={filterRule}
          onChange={(e) => {
            setFilterRule(e.target.value);
            setOffset(0);
          }}
          aria-label="Filter by rule ID"
        >
          <option value="">All Rules</option>
          <option value="AUTH-001">AUTH-001 (Brute-Force Auth)</option>
          <option value="IAM-001">IAM-001 (Admin Access Escalation)</option>
          <option value="IAM-002">IAM-002 (Wildcard AssumeRole)</option>
          <option value="S3-001">S3-001 (Block Public Access Removed)</option>
          <option value="S3-002">S3-002 (Public Read ACL)</option>
        </select>

        <select
          className="select-field"
          value={filterStatus}
          onChange={(e) => {
            setFilterStatus(e.target.value);
            setOffset(0);
          }}
          aria-label="Filter by alert status"
        >
          <option value="">All Statuses</option>
          <option value="OPEN">OPEN</option>
          <option value="INVESTIGATING">INVESTIGATING</option>
          <option value="RESOLVED">RESOLVED</option>
          <option value="FALSE_POSITIVE">FALSE_POSITIVE</option>
        </select>

        {(filterSeverity || filterRule || filterStatus) && (
          <button className="btn btn-secondary" onClick={handleResetFilters} style={{ fontSize: '0.8rem' }}>
            Clear Filters
          </button>
        )}
      </div>

      {loading ? (
        <LoadingState message="Loading security alerts from backend..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchAlerts} />
      ) : alerts.length === 0 ? (
        <EmptyState
          title="No alerts match criteria"
          message="No persistent security alerts found matching current filter parameters."
          action={
            (filterSeverity || filterRule || filterStatus) && (
              <button className="btn btn-secondary" onClick={handleResetFilters}>
                Reset Filters
              </button>
            )
          }
        />
      ) : (
        <>
          <div className="table-responsive">
            <table className="data-table" data-testid="alerts-table">
              <thead>
                <tr>
                  <th>Last Observed</th>
                  <th>Alert Title</th>
                  <th>Rule ID</th>
                  <th>Severity</th>
                  <th>Risk Score</th>
                  <th>Occurrences</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alt) => (
                  <tr
                    key={alt.id}
                    onClick={() => setSelectedAlert(alt)}
                    data-testid={`alert-row-${alt.alert_id}`}
                  >
                    <td className="font-mono" style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                      {new Date(alt.last_seen).toISOString().replace('T', ' ').slice(0, 19)}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{alt.title}</div>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8' }} className="font-mono">
                        {alt.alert_id}
                      </div>
                    </td>
                    <td>
                      <span className="font-mono" style={{ color: '#38bdf8' }}>
                        {alt.rule_id}
                      </span>
                    </td>
                    <td>
                      <SeverityBadge severity={alt.severity} />
                    </td>
                    <td>
                      <RiskScorePill score={alt.risk_score} />
                    </td>
                    <td style={{ fontWeight: 600, color: '#f1f5f9' }}>
                      {alt.occurrence_count}
                    </td>
                    <td>
                      <StatusBadge status={alt.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            total={total}
            limit={limit}
            offset={offset}
            onPageChange={setOffset}
            disabled={loading}
          />
        </>
      )}

      <AlertDetailDrawer alert={selectedAlert} onClose={() => setSelectedAlert(null)} />
    </div>
  );
};
