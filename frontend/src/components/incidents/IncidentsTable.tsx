import React, { useState, useEffect, useCallback } from 'react';
import { apiClient, ApiError } from '../../api/client';
import type { SecurityIncident } from '../../types/api';
import { EmptyState, ErrorState, LoadingState } from '../common/StateView';
import { Pagination } from '../common/Pagination';
import { SeverityBadge } from '../common/SeverityBadge';
import { StatusBadge } from '../common/StatusBadge';
import { RiskScorePill } from '../common/RiskScorePill';
import { IncidentDetailDrawer } from './IncidentDetailDrawer';
import { Filter, Layers, RefreshCw, ShieldCheck } from 'lucide-react';

export const IncidentsTable: React.FC = () => {
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [total, setTotal] = useState(0);
  const [limit] = useState(15);
  const [offset, setOffset] = useState(0);

  const [filterStatus, setFilterStatus] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterAnalyst, setFilterAnalyst] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

  const executeFetch = useCallback((isMountedRef?: { current: boolean }) => {
    return apiClient
      .getIncidents({
        limit,
        offset,
        status: filterStatus || undefined,
        severity: filterSeverity || undefined,
        assigned_analyst: filterAnalyst || undefined,
      })
      .then((data) => {
        if (isMountedRef && !isMountedRef.current) return;
        setIncidents(data.items);
        setTotal(data.total);
        setLoading(false);
      })
      .catch((err: any) => {
        if (isMountedRef && !isMountedRef.current) return;
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('Failed to fetch security incidents. Please verify backend connection.');
        }
        setLoading(false);
      });
  }, [limit, offset, filterStatus, filterSeverity, filterAnalyst]);

  const fetchIncidents = useCallback(() => {
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
    setFilterStatus('');
    setFilterSeverity('');
    setFilterAnalyst('');
    setOffset(0);
  };

  return (
    <div className="panel-card" data-testid="incidents-page-container">
      <div className="panel-header">
        <h2 className="panel-title">
          <ShieldCheck size={18} /> Correlated Security Incidents
        </h2>
        <button
          className="btn btn-secondary"
          onClick={fetchIncidents}
          disabled={loading}
          aria-label="Refresh incidents"
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
          value={filterStatus}
          onChange={(e) => {
            setFilterStatus(e.target.value);
            setOffset(0);
          }}
          aria-label="Filter by incident status"
          data-testid="filter-incident-status"
        >
          <option value="">All Statuses</option>
          <option value="OPEN">OPEN</option>
          <option value="INVESTIGATING">INVESTIGATING</option>
          <option value="RESOLVED">RESOLVED</option>
          <option value="FALSE_POSITIVE">FALSE_POSITIVE</option>
        </select>

        <select
          className="select-field"
          value={filterSeverity}
          onChange={(e) => {
            setFilterSeverity(e.target.value);
            setOffset(0);
          }}
          aria-label="Filter by incident severity"
          data-testid="filter-incident-severity"
        >
          <option value="">All Severities</option>
          <option value="CRITICAL">CRITICAL</option>
          <option value="HIGH">HIGH</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="LOW">LOW</option>
          <option value="INFORMATIONAL">INFORMATIONAL</option>
        </select>

        <input
          type="text"
          className="input-field"
          placeholder="Filter by Analyst..."
          value={filterAnalyst}
          onChange={(e) => {
            setFilterAnalyst(e.target.value);
            setOffset(0);
          }}
          aria-label="Filter by assigned analyst"
          style={{ width: '180px' }}
        />

        {(filterStatus || filterSeverity || filterAnalyst) && (
          <button className="btn btn-secondary" onClick={handleResetFilters} style={{ fontSize: '0.8rem' }}>
            Clear Filters
          </button>
        )}
      </div>

      {loading ? (
        <LoadingState message="Loading security incidents from backend..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchIncidents} />
      ) : incidents.length === 0 ? (
        <EmptyState
          title="No incidents match criteria"
          message="No correlated security incidents found matching current filter parameters."
          action={
            (filterStatus || filterSeverity || filterAnalyst) && (
              <button className="btn btn-secondary" onClick={handleResetFilters}>
                Reset Filters
              </button>
            )
          }
        />
      ) : (
        <>
          <div className="table-responsive">
            <table className="data-table" data-testid="incidents-table">
              <thead>
                <tr>
                  <th>Incident Identifier</th>
                  <th>Title & Summary</th>
                  <th>Severity</th>
                  <th>Risk Score</th>
                  <th>Alerts</th>
                  <th>Status</th>
                  <th>Assignee</th>
                  <th>Last Observed</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((inc) => (
                  <tr
                    key={inc.id}
                    onClick={() => setSelectedIncidentId(inc.incident_id)}
                    data-testid={`incident-row-${inc.incident_id}`}
                  >
                    <td className="font-mono" style={{ color: '#38bdf8', fontWeight: 600 }}>
                      {inc.incident_id}
                    </td>
                    <td style={{ maxWidth: '260px' }}>
                      <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{inc.title}</div>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {inc.summary}
                      </div>
                    </td>
                    <td>
                      <SeverityBadge severity={inc.severity} />
                    </td>
                    <td>
                      <RiskScorePill score={inc.risk_score} />
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600, color: '#f1f5f9' }}>
                        <Layers size={13} style={{ color: '#94a3b8' }} />
                        {inc.related_alert_ids?.length || 0}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={inc.status} />
                    </td>
                    <td style={{ fontSize: '0.8rem', color: inc.assigned_analyst ? '#f1f5f9' : '#64748b' }}>
                      {inc.assigned_analyst || 'Unassigned'}
                    </td>
                    <td className="font-mono" style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                      {new Date(inc.last_seen).toISOString().replace('T', ' ').slice(0, 19)}
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

      <IncidentDetailDrawer
        incidentId={selectedIncidentId}
        onClose={() => setSelectedIncidentId(null)}
        onIncidentUpdated={fetchIncidents}
      />
    </div>
  );
};
