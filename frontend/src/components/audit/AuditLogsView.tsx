import React, { useState, useEffect, useCallback } from 'react';
import { apiClient, ApiError } from '../../api/client';
import type { AuditLogEntry } from '../../types/api';
import { ErrorState, LoadingState, EmptyState } from '../common/StateView';
import { Pagination } from '../common/Pagination';
import { FileText, RefreshCw, Filter } from 'lucide-react';

const ACTION_COLORS: Record<string, string> = {
  CREATED: '#06b6d4',
  STATUS_CHANGED: '#a855f7',
  ASSIGNED: '#3b82f6',
  ALERTS_ATTACHED: '#f97316',
  RESOLVED: '#10b981',
  REOPENED: '#f59e0b',
  FALSE_POSITIVE: '#64748b',
};

function ActionBadge({ action }: { action: string }) {
  const color = ACTION_COLORS[action] || '#94a3b8';
  return (
    <span style={{
      display: 'inline-block', padding: '0.18rem 0.55rem', borderRadius: 4,
      fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.03em',
      background: `${color}20`, color, border: `1px solid ${color}50`,
      textTransform: 'uppercase',
    }}>
      {action.replace(/_/g, ' ')}
    </span>
  );
}

function StateChange({ prev, next }: { prev?: Record<string, any> | null; next?: Record<string, any> | null }) {
  if (!prev && !next) return null;
  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.3rem', fontSize: '0.75rem', flexWrap: 'wrap' }}>
      {prev && (
        <span style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '0.1rem 0.4rem', borderRadius: 4 }}>
          {Object.entries(prev).map(([k, v]) => `${k}: ${v}`).join(', ')}
        </span>
      )}
      {prev && next && <span style={{ color: '#64748b' }}>→</span>}
      {next && (
        <span style={{ color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '0.1rem 0.4rem', borderRadius: 4 }}>
          {Object.entries(next).map(([k, v]) => `${k}: ${v}`).join(', ')}
        </span>
      )}
    </div>
  );
}

export const AuditLogsView: React.FC = () => {
  const [items, setItems] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [filterIncident, setFilterIncident] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const limit = 25;

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    apiClient
      .getAuditLogs({
        limit,
        offset: page * limit,
        incident_id: filterIncident || undefined,
        action: filterAction || undefined,
      })
      .then((r) => { setItems(r.items); setTotal(r.total); setLoading(false); })
      .catch((err: any) => {
        setError(err instanceof ApiError ? err.message : 'Failed to load audit logs.');
        setLoading(false);
      });
  }, [page, filterIncident, filterAction]);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(0); load(); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={18} /> Audit Logs
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>
            Chronological record of all incident lifecycle changes
          </p>
        </div>
        <button className="btn btn-secondary" onClick={load} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <form className="toolbar-row" onSubmit={handleSearch}>
        <input
          className="input-field"
          placeholder="Filter by incident ID..."
          value={filterIncident}
          onChange={(e) => setFilterIncident(e.target.value)}
          style={{ minWidth: 220 }}
        />
        <select className="select-field" value={filterAction} onChange={(e) => { setFilterAction(e.target.value); setPage(0); }}>
          <option value="">All Actions</option>
          {Array.from(new Set([...Object.keys(ACTION_COLORS), ...items.map((i) => i.action)])).map((a) => (
            <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <button type="submit" className="btn btn-primary"><Filter size={14} /> Apply</button>
      </form>

      <div className="panel-card" style={{ padding: 0 }}>
        {loading ? <LoadingState message="Loading audit logs..." /> :
          error ? <ErrorState message={error} onRetry={load} /> :
          items.length === 0 ? <EmptyState icon={<FileText size={36} />} message="No audit log entries found." /> : (
            <>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Timestamp</th>
                      <th>Incident</th>
                      <th>Action</th>
                      <th>Actor</th>
                      <th>State Change</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((entry) => (
                      <tr key={entry.id}>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#475569' }}>{entry.id}</td>
                        <td style={{ fontSize: '0.78rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                          {new Date(entry.created_at).toLocaleString()}
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#06b6d4' }}>
                          {entry.incident_id.substring(0, 16)}...
                        </td>
                        <td><ActionBadge action={entry.action} /></td>
                        <td style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{entry.actor || <span style={{ color: '#475569' }}>system</span>}</td>
                        <td><StateChange prev={entry.previous_state} next={entry.new_state} /></td>
                        <td style={{ fontSize: '0.78rem', color: '#94a3b8', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {entry.reason || '—'}
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

