import React, { useState, useEffect, useCallback } from 'react';
import { apiClient, ApiError } from '../../api/client';
import type { InvestigationResponse } from '../../types/api';
import { EmptyState, ErrorState, LoadingState } from '../common/StateView';
import { Drawer } from '../common/Drawer';
import { Pagination } from '../common/Pagination';
import { BarChart3, Filter, RefreshCw, Search } from 'lucide-react';

/**
 * AI Investigations view — lists persisted investigation reports
 * from GET /api/v1/investigations (real PostgreSQL data).
 */
export const InvestigationsView: React.FC = () => {
  const [items, setItems] = useState<InvestigationResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [filterIncident, setFilterIncident] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<InvestigationResponse | null>(null);
  const limit = 15;

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    apiClient
      .listInvestigations({
        limit,
        offset: page * limit,
        incident_id: filterIncident || undefined,
      })
      .then((r) => {
        setItems(r.items);
        setTotal(r.total);
        setLoading(false);
      })
      .catch((e: any) => {
        setError(e instanceof ApiError ? e.message : 'Failed to load investigations.');
        setLoading(false);
      });
  }, [page, filterIncident]);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    load();
  };

  const confidenceColor = (level: string) =>
    level === 'HIGH' ? '#10b981' : level === 'MEDIUM' ? '#f59e0b' : level === 'LOW' ? '#64748b' : '#38bdf8';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} data-testid="investigations-page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BarChart3 size={18} /> AI Investigations
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>
            Generated investigation reports persisted from the investigation engine
          </p>
        </div>
        <button className="btn btn-secondary" onClick={load} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      <form className="toolbar-row" onSubmit={handleSearch}>
        <div className="search-input-wrapper">
          <Search size={14} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
          <input
            className="input-field"
            style={{ paddingLeft: '2rem' }}
            placeholder="Filter by incident ID..."
            value={filterIncident}
            onChange={(e) => setFilterIncident(e.target.value)}
            aria-label="Filter by incident ID"
          />
        </div>
        <button type="submit" className="btn btn-secondary"><Filter size={14} /> Apply</button>
        {filterIncident && (
          <button type="button" className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => { setFilterIncident(''); setPage(0); }}>
            Clear
          </button>
        )}
      </form>

      <div className="panel-card" style={{ padding: 0 }}>
        {loading ? (
          <LoadingState message="Loading investigation reports..." />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<BarChart3 size={36} />}
            title="No investigations found"
            message="No investigation reports match the current filter."
            sub="Generate a report from the Incident Management view using the AI Investigate action."
          />
        ) : (
          <>
            <div className="table-responsive">
              <table className="data-table" data-testid="investigations-table">
                <thead>
                  <tr>
                    <th>Investigation ID</th>
                    <th>Incident</th>
                    <th>Confidence</th>
                    <th>Engine</th>
                    <th>Summary</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((inv) => (
                    <tr key={inv.investigation_id} onClick={() => setSelected(inv)} data-testid={`investigation-row-${inv.investigation_id}`}>
                      <td className="font-mono" style={{ fontSize: '0.75rem', color: '#38bdf8' }}>{inv.investigation_id}</td>
                      <td className="font-mono" style={{ fontSize: '0.75rem', color: '#a855f7' }}>{inv.incident_id || '—'}</td>
                      <td>
                        <span style={{
                          fontFamily: 'monospace', fontSize: '0.72rem', fontWeight: 700,
                          color: confidenceColor(inv.confidence_level),
                          background: `${confidenceColor(inv.confidence_level)}18`,
                          border: `1px solid ${confidenceColor(inv.confidence_level)}40`,
                          padding: '0.15rem 0.5rem', borderRadius: 4,
                        }}>
                          {inv.confidence_level}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.72rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                        {inv.provider} · {inv.model}
                      </td>
                      <td style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                        {inv.summary}
                      </td>
                      <td style={{ fontSize: '0.78rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {new Date(inv.created_at).toLocaleString()}
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

      <Drawer
        isOpen={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.investigation_id || ''}
        subtitle={selected ? `Incident ${selected.incident_id || 'n/a'} · ${selected.confidence_level} confidence` : undefined}
      >
        {selected && (
          <>
            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '0.3rem', fontWeight: 600 }}>Summary</div>
              <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.6 }}>{selected.summary}</p>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '0.3rem', fontWeight: 600 }}>Observed Evidence</div>
              <ul style={{ paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {selected.observed_evidence.map((ev, i) => (
                  <li key={i} style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>{ev}</li>
                ))}
              </ul>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '0.3rem', fontWeight: 600 }}>Detection Explanation</div>
              <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.6 }}>{selected.detection_explanation}</p>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '0.3rem', fontWeight: 600 }}>Potential Impact</div>
              <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.6 }}>{selected.potential_impact}</p>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '0.3rem', fontWeight: 600 }}>Hypotheses</div>
              <ul style={{ paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {selected.hypotheses.map((h, i) => (
                  <li key={i} style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>{h}</li>
                ))}
              </ul>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '0.3rem', fontWeight: 600 }}>Recommended Steps</div>
              <ul style={{ paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {selected.recommended_steps.map((s, i) => (
                  <li key={i} style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>{s}</li>
                ))}
              </ul>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '0.3rem', fontWeight: 600 }}>Evidence References</div>
              <pre className="json-box">{JSON.stringify(selected.evidence_references, null, 2)}</pre>
            </div>

            <div className="detail-grid" style={{ fontSize: '0.8rem' }}>
              <span className="detail-label">Provider</span>
              <span className="detail-val font-mono">{selected.provider}</span>
              <span className="detail-label">Model</span>
              <span className="detail-val font-mono">{selected.model}</span>
              <span className="detail-label">Confidence</span>
              <span className="detail-val" style={{ color: confidenceColor(selected.confidence_level) }}>{selected.confidence_level}</span>
              <span className="detail-label">Limitations</span>
              <span className="detail-val">{selected.confidence_limitations}</span>
              <span className="detail-label">Created</span>
              <span className="detail-val font-mono">{new Date(selected.created_at).toLocaleString()}</span>
            </div>
          </>
        )}
      </Drawer>
    </div>
  );
};
