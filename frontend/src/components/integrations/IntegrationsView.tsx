import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../api/client';
import type { AWSIntegrationStatus, HealthResponse, SecurityEvent } from '../../types/api';
import { LoadingState } from '../common/StateView';
import {
  Cloud,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Database,
  Layers,
  Info,
  Link,
} from 'lucide-react';

function StatusIndicator({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      {ok ? <CheckCircle2 size={16} color="#10b981" /> : <XCircle size={16} color="#64748b" />}
      <span style={{ fontSize: '0.85rem', color: ok ? '#10b981' : '#64748b' }}>{label}</span>
    </div>
  );
}

function IntegrationCard({
  name, description, status, icon, children,
}: {
  name: string;
  description: string;
  status: 'connected' | 'unconfigured' | 'error';
  icon: React.ReactNode;
  children?: React.ReactNode;
}) {
  const statusColor = status === 'connected' ? '#10b981' : status === 'error' ? '#ef4444' : '#64748b';
  const statusText = status === 'connected' ? 'Connected' : status === 'error' ? 'Error' : 'Not Configured';

  return (
    <div className="panel-card" style={{ marginBottom: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(6,182,212,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#06b6d4' }}>
            {icon}
          </div>
          <div>
            <div style={{ fontWeight: 700, color: '#f1f5f9' }}>{name}</div>
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{description}</div>
          </div>
        </div>
        <span style={{
          padding: '0.2rem 0.65rem', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700,
          background: `${statusColor}18`, color: statusColor, border: `1px solid ${statusColor}40`,
        }}>
          ● {statusText}
        </span>
      </div>
      {children}
    </div>
  );
}

export const IntegrationsView: React.FC = () => {
  const [awsStatus, setAwsStatus] = useState<AWSIntegrationStatus | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [sourceCounts, setSourceCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      apiClient.getAWSStatus().catch(() => null),
      apiClient.getHealth().catch(() => null),
      apiClient.getEvents({ limit: 200 })
        .then((r) => {
          const counts: Record<string, number> = {};
          r.items.forEach((e: SecurityEvent) => { counts[e.source] = (counts[e.source] || 0) + 1; });
          return counts;
        })
        .catch(() => ({})),
    ])
      .then(([s, h, counts]) => {
        setAwsStatus(s);
        setHealth(h);
        setSourceCounts(counts);
        setLoading(false);
      })
      .catch(() => { setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const awsConnected = awsStatus?.status === 'active';
  const dbConnected = health ? health.database !== 'unavailable' : false;
  const synthCount = sourceCounts['simulator'] || 0;
  const engines = health?.engines;
  const detRules = engines?.detection?.rules || [];

  if (loading) return <LoadingState message="Checking integration status..." />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Link size={18} /> Integrations
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>
            Manage cloud source connections and data ingestion pipelines
          </p>
        </div>
        <button className="btn btn-secondary" onClick={load}>
          <RefreshCw size={14} /> Refresh Status
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
        {/* AWS CloudTrail */}
        <IntegrationCard
          name="AWS CloudTrail"
          description="Real-time cloud activity monitoring via SQS + S3"
          status={awsStatus ? (awsConnected ? 'connected' : 'unconfigured') : 'unconfigured'}
          icon={<Cloud size={20} />}
        >
          {awsStatus ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <StatusIndicator ok={awsStatus.sqs_configured} label="SQS Queue" />
                <StatusIndicator ok={awsStatus.s3_bucket_configured} label="S3 Bucket" />
                <StatusIndicator ok={awsStatus.custom_endpoint_active} label="Custom Endpoint" />
              </div>
              <div style={{ background: '#0d1117', borderRadius: 6, padding: '0.75rem', fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Region</span>
                  <span style={{ color: '#f1f5f9', fontFamily: 'monospace' }}>{awsStatus.region}</span>
                </div>
                {awsStatus.queue_url_masked && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Queue URL</span>
                    <span style={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: '0.72rem' }}>{awsStatus.queue_url_masked}</span>
                  </div>
                )}
              </div>
              {!awsConnected && (
                <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 6, padding: '0.65rem', fontSize: '0.78rem', color: '#fbbf24' }}>
                  <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>Set <code style={{ background: 'rgba(255,255,255,0.08)', padding: '0.1rem 0.3rem', borderRadius: 3 }}>AWS_CLOUDTRAIL_SQS_QUEUE_URL</code> in your <code>.env</code> to enable live ingestion.</span>
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: '#64748b', fontSize: '0.82rem' }}>Could not retrieve AWS status.</div>
          )}
        </IntegrationCard>

        {/* PostgreSQL — live status from /health */}
        <IntegrationCard
          name="PostgreSQL"
          description="Primary data store for events, alerts, and incidents"
          status={health ? (dbConnected ? 'connected' : 'error') : 'unconfigured'}
          icon={<Database size={20} />}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
            <StatusIndicator ok={dbConnected} label={dbConnected ? 'Connection Healthy' : 'Database Unavailable'} />
            <div style={{ background: '#0d1117', borderRadius: 6, padding: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Engine</span>
                <span style={{ color: '#f1f5f9', fontFamily: 'monospace' }}>PostgreSQL 16 (Alpine)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Tables</span>
                <span style={{ color: '#f1f5f9', fontFamily: 'monospace' }}>5 (events, alerts, incidents, investigations, audits)</span>
              </div>
            </div>
          </div>
        </IntegrationCard>

        {/* Event Simulator — real ingestion counts per source */}
        <IntegrationCard
          name="Event Simulator"
          description="Synthetic security event generator for testing"
          status={synthCount > 0 ? 'connected' : 'unconfigured'}
          icon={<Layers size={20} />}
        >
          <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <StatusIndicator ok={synthCount > 0} label={synthCount > 0 ? `${synthCount} synthetic events ingested` : 'No synthetic events ingested yet'} />
            <div style={{ background: '#0d1117', borderRadius: 6, padding: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {Object.keys(sourceCounts).length > 0 ? (
                Object.entries(sourceCounts).map(([src, n]) => (
                  <div key={src} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                    <span style={{ color: '#64748b', fontFamily: 'monospace' }}>{src}</span>
                    <span style={{ color: '#38bdf8', fontFamily: 'monospace' }}>{n} events</span>
                  </div>
                ))
              ) : (
                <div style={{ color: '#64748b', fontSize: '0.78rem' }}>No events ingested yet.</div>
              )}
            </div>
            <div style={{ color: '#64748b', fontSize: '0.75rem' }}>
              Additional synthetic events can be submitted manually via <code style={{ background: 'rgba(255,255,255,0.08)', padding: '0.1rem 0.3rem', borderRadius: 3 }}>POST /api/v1/events</code>.
            </div>
          </div>
        </IntegrationCard>

        {/* AI Investigation Engine — live provider/model from /health */}
        <IntegrationCard
          name="AI Investigation Engine"
          description="Offline rule-based engine · LLM provider hookable"
          status={engines?.investigation ? 'connected' : 'unconfigured'}
          icon={<Info size={20} />}
        >
          <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <StatusIndicator ok={Boolean(engines?.investigation)} label={engines?.investigation ? 'Investigation Engine Active' : 'Engine Not Reporting'} />
            <div style={{ background: '#0d1117', borderRadius: 6, padding: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Provider</span>
                <span style={{ color: '#f1f5f9', fontFamily: 'monospace' }}>{engines?.investigation?.provider || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Model</span>
                <span style={{ color: '#f1f5f9', fontFamily: 'monospace' }}>{engines?.investigation?.model || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Detection Rules</span>
                <span style={{ color: '#f1f5f9', fontFamily: 'monospace' }}>{detRules.length ? `${detRules.length} loaded (${detRules.join(', ')})` : '—'}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 6, padding: '0.65rem', fontSize: '0.78rem', color: '#93c5fd' }}>
              <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>Set <code style={{ background: 'rgba(255,255,255,0.08)', padding: '0.1rem 0.3rem', borderRadius: 3 }}>AI_PROVIDER</code> and <code style={{ background: 'rgba(255,255,255,0.08)', padding: '0.1rem 0.3rem', borderRadius: 3 }}>AI_API_KEY</code> to enable LLM-powered analysis.</span>
            </div>
          </div>
        </IntegrationCard>
      </div>
    </div>
  );
};
