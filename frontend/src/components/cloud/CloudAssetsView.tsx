import React, { useState, useEffect, useCallback } from 'react';
import { apiClient, ApiError } from '../../api/client';
import type { SecurityEvent } from '../../types/api';
import { ErrorState, LoadingState, EmptyState } from '../common/StateView';
import { Pagination } from '../common/Pagination';
import { RefreshCw, Database, Server } from 'lucide-react';

/**
 * Cloud Asset Inventory — derived from ingested security events.
 * Aggregates unique resources, accounts, regions, and actors from the event log.
 */
interface AssetSummary {
  resource: string;
  source: string;
  account_id?: string;
  region?: string;
  event_count: number;
  last_seen: string;
}

export const CloudAssetsView: React.FC = () => {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [filterRegion, setFilterRegion] = useState('');
  const limit = 25;

  const buildAssets = useCallback((evts: SecurityEvent[]): AssetSummary[] => {
    const map = new Map<string, AssetSummary>();
    for (const e of evts) {
      const key = `${e.resource || 'unknown'}::${e.source}`;
      const existing = map.get(key);
      if (existing) {
        existing.event_count++;
        if (new Date(e.timestamp) > new Date(existing.last_seen)) {
          existing.last_seen = e.timestamp;
        }
      } else {
        map.set(key, {
          resource: e.resource || 'unknown',
          source: e.source,
          account_id: e.account_id ?? undefined,
          region: e.region ?? undefined,
          event_count: 1,
          last_seen: e.timestamp,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.event_count - a.event_count);
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    apiClient.getEvents({ limit: 500, offset: 0 })
      .then((r) => {
        setEvents(r.items);
        setAssets(buildAssets(r.items));
        setLoading(false);
      })
      .catch((e: any) => {
        setError(e instanceof ApiError ? e.message : 'Failed to load cloud assets');
        setLoading(false);
      });
  }, [buildAssets]);

  useEffect(() => { load(); }, [load]);

  const regions = Array.from(new Set(events.map((e) => e.region).filter(Boolean))) as string[];
  const filteredAssets = filterRegion ? assets.filter((a) => a.region === filterRegion) : assets;
  const pageItems = filteredAssets.slice(page * limit, (page + 1) * limit);

  // Summary stats
  const uniqueRegions = new Set(assets.map((a) => a.region).filter(Boolean)).size;
  const uniqueAccounts = new Set(assets.map((a) => a.account_id).filter(Boolean)).size;
  const sources = new Set(assets.map((a) => a.source));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Database size={18} /> Cloud Asset Inventory
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>
            Discovered resources derived from ingested security events
          </p>
        </div>
        <button className="btn btn-secondary" onClick={load} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-info">
            <div className="metric-label">Unique Resources</div>
            <div className="metric-value" style={{ color: '#06b6d4' }}>{assets.length}</div>
          </div>
          <div className="metric-icon-box"><Server size={22} style={{ color: '#06b6d4' }} /></div>
        </div>
        <div className="metric-card">
          <div className="metric-info">
            <div className="metric-label">Regions</div>
            <div className="metric-value" style={{ color: '#3b82f6' }}>{uniqueRegions}</div>
          </div>
          <div className="metric-icon-box"><Database size={22} style={{ color: '#3b82f6' }} /></div>
        </div>
        <div className="metric-card">
          <div className="metric-info">
            <div className="metric-label">Accounts</div>
            <div className="metric-value" style={{ color: '#a855f7' }}>{uniqueAccounts}</div>
          </div>
          <div className="metric-icon-box"><Database size={22} style={{ color: '#a855f7' }} /></div>
        </div>
        <div className="metric-card">
          <div className="metric-info">
            <div className="metric-label">Data Sources</div>
            <div className="metric-value" style={{ color: '#10b981' }}>{sources.size}</div>
            <div className="metric-meta">{Array.from(sources).join(', ')}</div>
          </div>
          <div className="metric-icon-box"><Server size={22} style={{ color: '#10b981' }} /></div>
        </div>
      </div>

      {/* Region filter */}
      <div className="toolbar-row">
        <select className="select-field" value={filterRegion} onChange={(e) => { setFilterRegion(e.target.value); setPage(0); }}>
          <option value="">All Regions</option>
          {regions.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      <div className="panel-card" style={{ padding: 0 }}>
        {loading ? <LoadingState message="Discovering cloud assets..." /> :
          error ? <ErrorState message={error} onRetry={load} /> :
          pageItems.length === 0 ? (
            <EmptyState
              icon={<Database size={36} />}
              message="No cloud assets discovered yet."
              sub="Ingest security events to automatically populate the asset inventory."
            />
          ) : (
            <>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Resource</th>
                      <th>Source</th>
                      <th>Account ID</th>
                      <th>Region</th>
                      <th>Event Count</th>
                      <th>Last Seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((asset, idx) => (
                      <tr key={`${asset.resource}-${idx}`}>
                        <td style={{ maxWidth: 260 }}>
                          <div style={{ color: '#f1f5f9', fontFamily: 'monospace', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {asset.resource}
                          </div>
                        </td>
                        <td>
                          <span style={{ background: 'rgba(6,182,212,0.1)', color: '#06b6d4', padding: '0.15rem 0.4rem', borderRadius: 4, fontSize: '0.75rem', fontFamily: 'monospace' }}>
                            {asset.source}
                          </span>
                        </td>
                        <td style={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: '0.78rem' }}>
                          {asset.account_id || <span style={{ color: '#475569' }}>—</span>}
                        </td>
                        <td style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                          {asset.region || <span style={{ color: '#475569' }}>—</span>}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa', padding: '0.15rem 0.5rem', borderRadius: 999, fontSize: '0.75rem', fontWeight: 700 }}>
                            {asset.event_count}
                          </span>
                        </td>
                        <td style={{ color: '#64748b', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                          {new Date(asset.last_seen).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #1e2638' }}>
                <Pagination total={filteredAssets.length} limit={limit} offset={page * limit} onPageChange={(o) => setPage(Math.floor(o / limit))} />
              </div>
            </>
          )}
      </div>
    </div>
  );
};

