import React from 'react';
import type { SecurityAlert, SeverityLevel } from '../../types/api';

interface Props {
  alerts: SecurityAlert[];
}

export const SeverityChart: React.FC<Props> = ({ alerts }) => {
  const counts: Record<SeverityLevel, number> = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    INFORMATIONAL: 0,
  };

  alerts.forEach((a) => {
    const sev = (a.severity?.toUpperCase() || 'INFORMATIONAL') as SeverityLevel;
    if (counts[sev] !== undefined) {
      counts[sev] += 1;
    } else {
      counts.INFORMATIONAL += 1;
    }
  });

  const total = alerts.length;

  const config: { level: SeverityLevel; label: string; color: string }[] = [
    { level: 'CRITICAL', label: 'Critical', color: '#ef4444' },
    { level: 'HIGH', label: 'High', color: '#f97316' },
    { level: 'MEDIUM', label: 'Medium', color: '#f59e0b' },
    { level: 'LOW', label: 'Low', color: '#0ea5e9' },
    { level: 'INFORMATIONAL', label: 'Info', color: '#64748b' },
  ];

  return (
    <div className="panel-card" data-testid="severity-chart">
      <div className="panel-header">
        <h3 className="panel-title">Alert Severity Distribution</h3>
        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
          {total} Total Sampled Alerts
        </span>
      </div>

      {total === 0 ? (
        <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No alerts recorded to display distribution.</p>
      ) : (
        <>
          <div
            className="dist-bar-container"
            role="progressbar"
            aria-label="Alert severity distribution"
            aria-valuemin={0}
            aria-valuemax={100}
          >
            {config.map((item) => {
              const pct = (counts[item.level] / total) * 100;
              if (pct === 0) return null;
              return (
                <div
                  key={item.level}
                  className="dist-bar-segment"
                  style={{ width: `${pct}%`, backgroundColor: item.color }}
                  title={`${item.label}: ${counts[item.level]} (${pct.toFixed(1)}%)`}
                />
              );
            })}
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '1.25rem',
              marginTop: '1rem',
              fontSize: '0.82rem',
            }}
          >
            {config.map((item) => {
              const count = counts[item.level];
              const pct = total > 0 ? ((count / total) * 100).toFixed(0) : '0';
              return (
                <div key={item.level} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <span
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '2px',
                      backgroundColor: item.color,
                      display: 'inline-block',
                    }}
                  />
                  <span style={{ color: '#cbd5e1' }}>{item.label}:</span>
                  <span style={{ fontWeight: 700, color: '#f1f5f9' }}>
                    {count} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>

          <p style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#64748b' }}>
            Accessible summary: {config.map((c) => `${counts[c.level]} ${c.label}`).join(', ')}.
          </p>
        </>
      )}
    </div>
  );
};
