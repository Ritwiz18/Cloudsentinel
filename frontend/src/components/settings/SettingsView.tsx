import React, { useState, useEffect } from 'react';
import { Settings, Info, Shield, Database, Server, Code2 } from 'lucide-react';
import { apiClient } from '../../api/client';
import type { DetectionRule, HealthResponse } from '../../types/api';

/**
 * Settings View — displays system configuration and documentation.
 * Read-only: does NOT expose secrets or allow destructive operations.
 * Live values come from /health and /api/v1/detections/rules.
 */

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="panel-card">
      <div className="panel-header">
        <div className="panel-title">{icon} {title}</div>
      </div>
      {children}
    </div>
  );
}

function ConfigRow({ label, value, mono = false, sensitive = false }: {
  label: string;
  value: string;
  mono?: boolean;
  sensitive?: boolean;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0', borderBottom: '1px solid rgba(30,38,56,0.5)', gap: '1rem' }}>
      <span style={{ color: '#64748b', fontSize: '0.82rem', flexShrink: 0 }}>{label}</span>
      <span style={{
        color: sensitive ? '#475569' : '#f1f5f9',
        fontFamily: mono ? 'monospace' : undefined,
        fontSize: mono ? '0.78rem' : '0.82rem',
        textAlign: 'right',
      }}>
        {sensitive ? '••••••••' : value}
      </span>
    </div>
  );
}

export const SettingsView: React.FC = () => {
  const apiBase = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8000';
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [rules, setRules] = useState<DetectionRule[]>([]);

  useEffect(() => {
    apiClient.getHealth().then(setHealth).catch(() => {});
    if (typeof apiClient.getDetectionRules === 'function') {
      apiClient.getDetectionRules().then((r) => setRules(r.rules)).catch(() => {});
    }
  }, []);

  const ruleIds = rules.map((r) => r.rule_id);
  const dbOk = health?.database !== 'unavailable';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Settings size={18} /> Settings & Configuration
        </h2>
        <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>
          System configuration overview — credentials are managed via environment variables only
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
        {/* System Info */}
        <Section title="System Information" icon={<Info size={16} />}>
          <ConfigRow label="Application" value="CloudSentinel" />
          <ConfigRow label="API Version" value={health?.version || 'Checking…'} mono />
          <ConfigRow label="API Status" value={health?.status || 'Checking…'} mono />
          <ConfigRow label="Environment" value={(import.meta as any).env?.DEV ? 'Development' : 'Production'} />
          <ConfigRow label="API Base URL" value={apiBase} mono />
          <ConfigRow label="Frontend Framework" value="React 19 + Vite 8" />
          <ConfigRow label="Backend Framework" value="FastAPI + SQLAlchemy 2" />
        </Section>

        {/* Database */}
        <Section title="Database" icon={<Database size={16} />}>
          <ConfigRow label="Connection Status" value={health ? (dbOk ? 'connected' : 'unavailable') : 'Checking…'} mono />
          <ConfigRow label="Engine" value="PostgreSQL 16 (Alpine)" />
          <ConfigRow label="Host" value="postgres (Docker internal)" mono />
          <ConfigRow label="Port" value="5432" mono />
          <ConfigRow label="Username" value="cloudsentinel_user" mono />
          <ConfigRow label="Password" value="[managed via env]" sensitive />
          <ConfigRow label="Tables" value="security_events, security_alerts, security_incidents, security_investigations, incident_audits" />
        </Section>

        {/* Security Settings */}
        <Section title="Security" icon={<Shield size={16} />}>
          <ConfigRow label="CORS Origins" value="localhost:5173, localhost:3000 (+ loopback variants)" mono />
          <ConfigRow label="AWS Credentials" value="[managed via env/IAM]" sensitive />
          <ConfigRow label="AI API Key" value="[managed via env]" sensitive />
          <ConfigRow label="Detection Rules" value={rules.length ? `${rules.length} loaded (${ruleIds.join(', ')})` : 'Checking…'} />
          <ConfigRow label="Alert Threshold" value="LOW and above" />
          <ConfigRow label="Deduplication" value="Fingerprint-based (SHA-256)" />
        </Section>

        {/* API Endpoints */}
        <Section title="API Endpoints" icon={<Server size={16} />}>
          {[
            ['Dashboard Overview', 'GET /api/v1/dashboard/overview'],
            ['Security Events', 'GET /api/v1/events'],
            ['Security Alerts', 'GET /api/v1/alerts'],
            ['Detection Rules', 'GET /api/v1/detections/rules'],
            ['Incidents', 'GET /api/v1/incidents'],
            ['Investigations', 'GET /api/v1/investigations'],
            ['Detection Engine', 'POST /api/v1/detections/run'],
            ['Correlation Engine', 'POST /api/v1/incidents/correlate'],
            ['AI Investigation', 'POST /api/v1/incidents/{id}/investigate'],
            ['AWS Integration Status', 'GET /api/v1/integrations/aws/status'],
            ['AWS CloudTrail Poll', 'POST /api/v1/integrations/aws/poll'],
            ['AWS Raw Ingest', 'POST /api/v1/integrations/aws/ingest-raw'],
            ['Audit Logs', 'GET /api/v1/audit/logs'],
            ['Health Check', 'GET /health'],
          ].map(([name, path]) => (
            <div key={path} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid rgba(30,38,56,0.5)', gap: '1rem' }}>
              <span style={{ color: '#64748b', fontSize: '0.78rem', flexShrink: 0 }}>{name}</span>
              <code style={{ color: '#38bdf8', fontSize: '0.72rem', background: 'rgba(6,182,212,0.08)', padding: '0.15rem 0.4rem', borderRadius: 4, textAlign: 'right' }}>{path}</code>
            </div>
          ))}
        </Section>

        {/* Docs & Links */}
        <Section title="Documentation" icon={<Code2 size={16} />}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <p style={{ color: '#64748b', fontSize: '0.78rem', lineHeight: 1.5 }}>
              The following documents live in the repository <code style={{ background: 'rgba(255,255,255,0.08)', padding: '0.1rem 0.3rem', borderRadius: 3 }}>docs/</code> folder.
              Interactive API documentation is served by the backend:
            </p>
            {[
              { label: 'API Documentation (Swagger)', href: `${apiBase}/docs` },
              { label: 'API Documentation (ReDoc)', href: `${apiBase}/redoc` },
            ].map(({ label, href }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#3b82f6', fontSize: '0.82rem', textDecoration: 'none' }}
                onMouseEnter={(e) => ((e.target as HTMLElement).style.textDecoration = 'underline')}
                onMouseLeave={(e) => ((e.target as HTMLElement).style.textDecoration = 'none')}
              >
                {label} ↗
              </a>
            ))}
            {['architecture.md', 'api-contract.md', 'aws-cloudtrail-integration.md', 'development-setup.md'].map((f) => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#94a3b8', fontSize: '0.82rem' }}>
                <Code2 size={12} /> docs/{f}
              </div>
            ))}
          </div>
        </Section>

        {/* Important Notice */}
        <div style={{ gridColumn: '1 / -1' }}>
          <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, padding: '1rem 1.25rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <Shield size={18} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ color: '#fbbf24', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.3rem' }}>Security Notice</div>
              <div style={{ color: '#94a3b8', fontSize: '0.8rem', lineHeight: 1.6 }}>
                All sensitive configuration (AWS credentials, database passwords, AI API keys) is managed exclusively through environment variables in <code style={{ background: 'rgba(255,255,255,0.08)', padding: '0.1rem 0.3rem', borderRadius: 3 }}>.env</code>.
                Never commit credentials to source control. Refer to <code>.env.example</code> for required variable names.
                Automated remediation actions (resource deletion, IAM changes) require explicit human approval and are never triggered automatically.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
