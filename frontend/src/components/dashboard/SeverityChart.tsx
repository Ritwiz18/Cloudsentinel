import React from 'react';
import { AlertTriangle, Eye } from 'lucide-react';
import type { SeverityCount, StatusCount } from '../../types/api';

export interface SeverityChartProps {
  severityCounts: SeverityCount;
  statusCounts?: StatusCount;
  onViewAll?: () => void;
}

export const SeverityChart: React.FC<SeverityChartProps> = ({
  severityCounts,
  statusCounts,
  onViewAll,
}) => {
  const total =
    severityCounts.CRITICAL +
    severityCounts.HIGH +
    severityCounts.MEDIUM +
    severityCounts.LOW +
    severityCounts.INFORMATIONAL;

  const segments = [
    { key: 'CRITICAL', label: 'Critical', color: '#ef4444', count: severityCounts.CRITICAL },
    { key: 'HIGH', label: 'High', color: '#f97316', count: severityCounts.HIGH },
    { key: 'MEDIUM', label: 'Medium', color: '#eab308', count: severityCounts.MEDIUM },
    { key: 'LOW', label: 'Low', color: '#22c55e', count: severityCounts.LOW },
    { key: 'INFO', label: 'Info', color: '#64748b', count: severityCounts.INFORMATIONAL },
  ];

  const statusList = [
    { key: 'OPEN', label: 'Open', count: statusCounts?.OPEN ?? 0, color: '#f59e0b' },
    { key: 'INVESTIGATING', label: 'Investigating', count: statusCounts?.INVESTIGATING ?? 0, color: '#a855f7' },
    { key: 'RESOLVED', label: 'Resolved', count: statusCounts?.RESOLVED ?? 0, color: '#22c55e' },
    { key: 'FALSE_POSITIVE', label: 'False Pos', count: statusCounts?.FALSE_POSITIVE ?? 0, color: '#64748b' },
  ];

  return (
    <div className="panel-card" style={{ flex: 1, minWidth: 280 }} data-testid="severity-chart">
      <div className="panel-header">
        <div className="panel-title">
          <AlertTriangle size={16} /> Alert Severity Distribution
        </div>
        {onViewAll && (
          <button
            className="btn btn-secondary"
            style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem' }}
            onClick={onViewAll}
            aria-label="View all alerts"
          >
            <Eye size={12} /> View Alerts
          </button>
        )}
      </div>

      {total === 0 ? (
        <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '1rem 0' }}>
          No alerts recorded. Security posture clean.
        </p>
      ) : (
        <>
          <div
            className="dist-bar-container"
            role="progressbar"
            aria-label="Alert severity distribution"
            aria-valuemin={0}
            aria-valuemax={100}
            style={{
              height: 10,
              display: 'flex',
              borderRadius: 6,
              overflow: 'hidden',
              background: '#0d131f',
              margin: '0.75rem 0',
            }}
          >
            {segments.map((seg) => {
              if (seg.count === 0) return null;
              const pct = (seg.count / total) * 100;
              return (
                <div
                  key={seg.key}
                  style={{
                    width: `${pct}%`,
                    background: seg.color,
                    transition: 'width 0.4s ease',
                  }}
                  title={`${seg.label}: ${seg.count} (${pct.toFixed(1)}%)`}
                />
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
            {segments.map((seg) => (
              <div
                key={seg.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.78rem',
                  color: '#94a3b8',
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: seg.color,
                    display: 'inline-block',
                  }}
                />
                {seg.label} <strong style={{ color: '#f1f5f9' }}>{seg.count}</strong>
              </div>
            ))}
          </div>

          {statusCounts && (
            <div
              style={{
                marginTop: '1.25rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))',
                gap: '0.65rem',
                paddingTop: '0.85rem',
                borderTop: '1px solid var(--border-subtle, #1e293b)',
              }}
            >
              {statusList.map((st) => (
                <div
                  key={st.key}
                  style={{
                    textAlign: 'center',
                    padding: '0.45rem',
                    background: '#0a101d',
                    borderRadius: 6,
                    border: '1px solid #162235',
                  }}
                >
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: st.color }}>
                    {st.count}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase' }}>
                    {st.label}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
