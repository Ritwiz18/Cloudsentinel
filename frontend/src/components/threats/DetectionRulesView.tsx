import React, { useState, useEffect, useCallback } from 'react';
import { apiClient, ApiError } from '../../api/client';
import type { DetectionRule } from '../../types/api';
import { ErrorState, LoadingState } from '../common/StateView';
import {
  CheckCircle,
  FileCode,
  Filter,
  Info,
  RefreshCw,
  Search,
  ShieldAlert,
} from 'lucide-react';

export const DetectionRulesView: React.FC = () => {
  const [rules, setRules] = useState<DetectionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [modeFilter, setModeFilter] = useState('ALL');

  const fetchRules = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.getDetectionRules();
      setRules(res.rules || []);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load detection rules from backend engine.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRules();
  }, [fetchRules]);

  const filteredRules = rules.filter((r) => {
    const matchesSearch =
      r.rule_id.toLowerCase().includes(search.toLowerCase()) ||
      r.rule_name.toLowerCase().includes(search.toLowerCase()) ||
      r.description.toLowerCase().includes(search.toLowerCase());
    const matchesMode = modeFilter === 'ALL' || r.evaluation_mode.toUpperCase() === modeFilter;
    return matchesSearch && matchesMode;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} data-testid="rules-page-container">
      {/* Header Banner */}
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
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 6,
                background: 'rgba(6, 182, 212, 0.12)',
                border: '1px solid rgba(6, 182, 212, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#06b6d4',
              }}
            >
              <FileCode size={20} />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
              Detection Rule Engine Catalog
            </h2>
          </div>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0.35rem 0 0' }}>
            Active deterministic detection signatures evaluating raw normalized security telemetry against known MITRE ATT&CK patterns.
          </p>
        </div>

        <button
          className="btn btn-secondary"
          onClick={fetchRules}
          disabled={loading}
          style={{ fontSize: '0.78rem', padding: '0.45rem 0.85rem' }}
        >
          <RefreshCw size={13} className={loading ? 'spin' : ''} />
          <span>Reload Rules</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          padding: '0.85rem 1rem',
          background: '#0a0f1d',
          borderRadius: 8,
          border: '1px solid #1e293b',
        }}
      >
        <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input
            type="text"
            placeholder="Search by rule ID (e.g. AUTH-001), name or signature description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '0.45rem 0.85rem 0.45rem 2.2rem',
              background: '#060913',
              border: '1px solid #1e293b',
              borderRadius: 6,
              color: '#f1f5f9',
              fontSize: '0.82rem',
              outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Filter size={13} /> Mode:
          </span>
          <select
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value)}
            style={{
              padding: '0.45rem 0.75rem',
              background: '#060913',
              border: '1px solid #1e293b',
              borderRadius: 6,
              color: '#f1f5f9',
              fontSize: '0.8rem',
            }}
          >
            <option value="ALL">All Modes</option>
            <option value="SINGLE_EVENT">Single Event</option>
            <option value="BATCH">Batch / Sliding Window</option>
          </select>
        </div>
      </div>

      {/* Rules Table */}
      {loading ? (
        <LoadingState message="Loading detection rules from engine..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchRules} />
      ) : filteredRules.length === 0 ? (
        <div className="state-box" style={{ padding: '3rem', textAlign: 'center' }}>
          <Info size={32} style={{ color: '#64748b', margin: '0 auto 0.5rem' }} />
          <p style={{ color: '#f1f5f9', fontWeight: 600 }}>No detection rules found</p>
          <p style={{ color: '#64748b', fontSize: '0.8rem' }}>Try clearing the search query or mode filter.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', background: '#0f172a', borderRadius: 8, border: '1px solid #1e293b' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e293b', color: '#64748b', textAlign: 'left', background: '#0a0f1d' }}>
                <th style={{ padding: '0.85rem 1rem', width: 140 }}>Rule Identifier</th>
                <th style={{ padding: '0.85rem 1rem', width: 240 }}>Rule Title</th>
                <th style={{ padding: '0.85rem 1rem' }}>Detection Logic & Scope</th>
                <th style={{ padding: '0.85rem 1rem', width: 150 }}>Evaluation Mode</th>
                <th style={{ padding: '0.85rem 1rem', width: 130 }}>Alert Policy</th>
                <th style={{ padding: '0.85rem 1rem', width: 100, textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRules.map((rule) => {
                const isBenign = !rule.generates_alerts;
                return (
                  <tr
                    key={rule.rule_id}
                    style={{
                      borderBottom: '1px solid #1e293b',
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          color: isBenign ? '#64748b' : '#38bdf8',
                          padding: '0.2rem 0.5rem',
                          background: '#060913',
                          border: '1px solid #1e293b',
                          borderRadius: 4,
                        }}
                      >
                        {rule.rule_id}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{rule.rule_name}</div>
                      {isBenign && (
                        <div style={{ fontSize: '0.7rem', color: '#22c55e', marginTop: '0.15rem' }}>
                          ● Non-alerting filter rule
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: '#94a3b8', lineHeight: 1.5 }}>
                      {rule.description}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          padding: '0.2rem 0.55rem',
                          borderRadius: 4,
                          background: '#060913',
                          border: '1px solid #1e293b',
                          color: '#e2e8f0',
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      >
                        {rule.evaluation_mode}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      {rule.generates_alerts ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            fontSize: '0.75rem',
                            color: '#ef4444',
                            fontWeight: 600,
                          }}
                        >
                          <ShieldAlert size={14} /> Generates Alert
                        </span>
                      ) : (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            fontSize: '0.75rem',
                            color: '#22c55e',
                            fontWeight: 600,
                          }}
                        >
                          <CheckCircle size={14} /> Filter / Suppress
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '9999px',
                          fontSize: '0.72rem',
                          background: 'rgba(34, 197, 94, 0.1)',
                          color: '#22c55e',
                          fontWeight: 600,
                          border: '1px solid rgba(34, 197, 94, 0.25)',
                        }}
                      >
                        Active
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
