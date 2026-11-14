import React, { useState, useEffect, useCallback } from 'react';
import { apiClient, ApiError } from '../../api/client';
import type { SecurityEvent } from '../../types/api';
import { ErrorState, LoadingState, EmptyState } from '../common/StateView';
import { RefreshCw, Wifi, Globe, AlertTriangle } from 'lucide-react';

/**
 * Network Monitoring View — derives network-level insights from security events.
 * Shows source IPs, event outcomes, and traffic patterns.
 */
interface NetworkEntry {
  source_ip: string;
  event_count: number;
  failure_count: number;
  event_types: string[];
  actors: string[];
  regions: string[];
  last_seen: string;
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW';
}

function RiskLevel({ level }: { level: 'HIGH' | 'MEDIUM' | 'LOW' }) {
  const colors = { HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#10b981' };
  const c = colors[level];
  return (
    <span style={{
      padding: '0.18rem 0.5rem', borderRadius: 4, fontSize: '0.72rem', fontWeight: 700,
      background: `${c}18`, color: c, border: `1px solid ${c}40`,
    }}>
      {level}
    </span>
  );
}

export const NetworkView: React.FC = () => {
  const [entries, setEntries] = useState<NetworkEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterRisk, setFilterRisk] = useState('');

  const buildNetworkData = (evts: SecurityEvent[]): NetworkEntry[] => {
    const map = new Map<string, NetworkEntry>();
    for (const e of evts) {
      const ip = e.source_ip;
      if (!ip) continue;
      const existing = map.get(ip);
      if (existing) {
        existing.event_count++;
        if (e.outcome === 'FAILURE' || e.outcome === 'DENIED') existing.failure_count++;
        if (!existing.event_types.includes(e.event_type)) existing.event_types.push(e.event_type);
        if (e.actor && !existing.actors.includes(e.actor)) existing.actors.push(e.actor);
        if (e.region && !existing.regions.includes(e.region)) existing.regions.push(e.region);
        if (new Date(e.timestamp) > new Date(existing.last_seen)) existing.last_seen = e.timestamp;
      } else {
        map.set(ip, {
          source_ip: ip,
          event_count: 1,
          failure_count: (e.outcome === 'FAILURE' || e.outcome === 'DENIED') ? 1 : 0,
          event_types: [e.event_type],
          actors: e.actor ? [e.actor] : [],
          regions: e.region ? [e.region] : [],
          last_seen: e.timestamp,
          risk_level: 'LOW',
        });
      }
    }
    // Calculate risk level
    for (const entry of map.values()) {
      const failureRatio = entry.event_count > 0 ? entry.failure_count / entry.event_count : 0;
      if (entry.failure_count >= 10 || failureRatio >= 0.8) entry.risk_level = 'HIGH';
      else if (entry.failure_count >= 3 || failureRatio >= 0.4) entry.risk_level = 'MEDIUM';
      else entry.risk_level = 'LOW';
    }
    return Array.from(map.values()).sort((a, b) => b.failure_count - a.failure_count || b.event_count - a.event_count);
  };

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    apiClient.getEvents({ limit: 500, offset: 0 })
      .then((r) => {
        setEntries(buildNetworkData(r.items));
        setLoading(false);
      })
      .catch((e: any) => {
        setError(e instanceof ApiError ? e.message : 'Failed to load network data');
        setLoading(false);
      });
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filterRisk ? entries.filter((e) => e.risk_level === filterRisk) : entries;
  const highRisk = entries.filter((e) => e.risk_level === 'HIGH').length;
  const medRisk = entries.filter((e) => e.risk_level === 'MEDIUM').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Wifi size={18} /> Network Monitoring
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>
            Source IP analysis and network activity patterns from security events
          </p>
        </div>
        <button className="btn btn-secondary" onClick={load} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {/* Stats Row */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-info">
            <div className="metric-label">Unique IPs</div>
            <div className="metric-value" style={{ color: '#06b6d4' }}>{entries.length}</div>
          </div>
          <div className="metric-icon-box"><Globe size={22} style={{ color: '#06b6d4' }} /></div>
        </div>
        <div className="metric-card">
          <div className="metric-info">
            <div className="metric-label">High Risk IPs</div>
            <div className="metric-value" style={{ color: '#ef4444' }}>{highRisk}</div>
          </div>
          <div className="metric-icon-box"><AlertTriangle size={22} style={{ color: '#ef4444' }} /></div>
        </div>
        <div className="metric-card">
          <div className="metric-info">
            <div className="metric-label">Medium Risk IPs</div>
            <div className="metric-value" style={{ color: '#f59e0b' }}>{medRisk}</div>
          </div>
          <div className="metric-icon-box"><Wifi size={22} style={{ color: '#f59e0b' }} /></div>
        </div>
      </div>

      {/* Risk Filter */}
      <div className="toolbar-row">
        {['', 'HIGH', 'MEDIUM', 'LOW'].map((r) => (
          <button
            key={r || 'all'}
            className={`btn ${filterRisk === r ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.78rem', padding: '0.3rem 0.75rem' }}
            onClick={() => setFilterRisk(r)}
          >
            {r || 'All Risk Levels'}
          </button>
        ))}
      </div>

      <div className="panel-card" style={{ padding: 0 }}>
        {loading ? <LoadingState message="Analyzing network traffic..." /> :
          error ? <ErrorState message={error} onRetry={load} /> :
          filtered.length === 0 ? (
            <EmptyState
              icon={<Wifi size={36} />}
              message="No network data available."
              sub="Ingest events with source_ip fields to populate network monitoring."
            />
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Source IP</th>
                    <th>Risk Level</th>
                    <th>Events</th>
                    <th>Failures</th>
                    <th>Event Types</th>
                    <th>Actors</th>
                    <th>Last Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((entry) => (
                    <tr key={entry.source_ip}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#38bdf8' }}>{entry.source_ip}</td>
                      <td><RiskLevel level={entry.risk_level} /></td>
                      <td style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>{entry.event_count}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ color: entry.failure_count > 0 ? '#ef4444' : '#10b981', fontWeight: 600, fontSize: '0.82rem' }}>
                          {entry.failure_count}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.75rem', color: '#64748b', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.event_types.join(', ')}
                      </td>
                      <td style={{ fontSize: '0.75rem', color: '#94a3b8', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.actors.join(', ') || <span style={{ color: '#475569' }}>—</span>}
                      </td>
                      <td style={{ color: '#64748b', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                        {new Date(entry.last_seen).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </div>
  );
};

