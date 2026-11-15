import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import type { HealthResponse, Tab } from './types/api';
import { apiClient } from './api/client';
import { LoadingState } from './components/common/StateView';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Cpu,
  FileCode,
  LayoutDashboard,
  Link,
  Menu,
  Play,
  Settings,
  Shield,
  ShieldAlert,
  X,
  Zap,
} from 'lucide-react';

// Core Views
import { OverviewView } from './components/dashboard/OverviewView';
import { EventsTable } from './components/events/EventsTable';
import { AlertsTable } from './components/alerts/AlertsTable';
import { IncidentsTable } from './components/incidents/IncidentsTable';
import { DetectionRulesView } from './components/threats/DetectionRulesView';

// Secondary Views
const ThreatDetectionView = lazy(() =>
  import('./components/threats/ThreatDetectionView').then((m) => ({ default: m.ThreatDetectionView }))
);
const AuditLogsView = lazy(() =>
  import('./components/audit/AuditLogsView').then((m) => ({ default: m.AuditLogsView }))
);
const IntegrationsView = lazy(() =>
  import('./components/integrations/IntegrationsView').then((m) => ({ default: m.IntegrationsView }))
);
const SettingsView = lazy(() =>
  import('./components/settings/SettingsView').then((m) => ({ default: m.SettingsView }))
);
const OperationsView = lazy(() =>
  import('./components/operations/OperationsView').then((m) => ({ default: m.OperationsView }))
);
const InvestigationsView = lazy(() =>
  import('./components/investigations/InvestigationsView').then((m) => ({ default: m.InvestigationsView }))
);
const CloudAssetsView = lazy(() =>
  import('./components/cloud/CloudAssetsView').then((m) => ({ default: m.CloudAssetsView }))
);
const IAMRiskView = lazy(() =>
  import('./components/cloud/IAMRiskView').then((m) => ({ default: m.IAMRiskView }))
);
const NetworkView = lazy(() =>
  import('./components/cloud/NetworkView').then((m) => ({ default: m.NetworkView }))
);
const CSPMView = lazy(() =>
  import('./components/cloud/CSPMView').then((m) => ({ default: m.CSPMView }))
);
const AWSMonitoringView = lazy(() =>
  import('./components/operations/AWSMonitoringView').then((m) => ({ default: m.AWSMonitoringView }))
);

interface NavSection {
  id: Tab;
  label: string;
  icon: React.ReactNode;
  category: 'PRIMARY OPERATIONS' | 'ADVANCED TOOLS';
  badge?: string;
}

// 9 Exact Core Sections Specified for CloudSentinel 2.0
const CORE_NAV_ITEMS: NavSection[] = [
  { id: 'overview', label: 'Command Center', icon: <LayoutDashboard size={18} />, category: 'PRIMARY OPERATIONS' },
  { id: 'threats', label: 'Threat Intelligence', icon: <ShieldAlert size={18} />, category: 'PRIMARY OPERATIONS' },
  { id: 'events', label: 'Event Explorer', icon: <Activity size={18} />, category: 'PRIMARY OPERATIONS' },
  { id: 'alerts', label: 'Alert Management', icon: <AlertTriangle size={18} />, category: 'PRIMARY OPERATIONS' },
  { id: 'incidents', label: 'Incident Response', icon: <Zap size={18} />, category: 'PRIMARY OPERATIONS' },
  { id: 'rules', label: 'Detection Rules', icon: <FileCode size={18} />, category: 'PRIMARY OPERATIONS' },
  { id: 'audit', label: 'Audit Center', icon: <BookOpen size={18} />, category: 'PRIMARY OPERATIONS' },
  { id: 'integrations', label: 'Integrations', icon: <Link size={18} />, category: 'PRIMARY OPERATIONS' },
  { id: 'settings', label: 'System Settings', icon: <Settings size={18} />, category: 'PRIMARY OPERATIONS' },

  // Tools & Utilities
  { id: 'operations', label: 'Operations & Pipeline', icon: <Cpu size={18} />, category: 'ADVANCED TOOLS' },
  { id: 'investigate', label: 'AI Investigation', icon: <BarChart3 size={18} />, category: 'ADVANCED TOOLS' },
];

const SECTION_DESCRIPTIONS: Record<string, string> = {
  overview: 'Global security posture, telemetry activity timeline, priority alerts and active incidents.',
  threats: 'Threat detection heuristics, MITRE ATT&CK tactic mappings, and evaluation activity.',
  events: 'Search and inspect raw normalized security telemetry events across cloud sources.',
  alerts: 'Triage, prioritize, and investigate detection rule findings with risk scoring.',
  incidents: 'Manage correlated threat clusters, assigned analysts, status transitions, and audit records.',
  rules: 'Inspect active deterministic detection signatures, evaluation modes, and alert policies.',
  audit: 'Immutable compliance trail of all analyst incident modifications and investigations.',
  integrations: 'Manage CloudTrail connectors, SQS poll configurations, and ingestion pipelines.',
  settings: 'Configure platform thresholds, detection toggles, and view database connection status.',
  operations: 'Execute manual detection evaluations, test correlations, and run system diagnostics.',
  investigate: 'Automated AI root-cause investigation synthesis and recommended response actions.',
};

function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingState message="Loading workspace..." />}>{children}</Suspense>;
}

function getConnectionStatus(health: HealthResponse | null, online: boolean | null): string {
  if (online === null) return 'Connecting...';
  if (online) {
    if (health?.database === 'unavailable') {
      return 'API: Connected (DB offline)';
    }
    return 'API: Connected';
  }
  return 'API: Offline';
}

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [triggeringAction, setTriggeringAction] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [utcTime, setUtcTime] = useState<string>('');

  const checkHealth = useCallback(async () => {
    try {
      const h = await apiClient.getHealth();
      setHealth(h);
      setApiOnline(true);
    } catch {
      setHealth(null);
      setApiOnline(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    void checkHealth();
    const interval = setInterval(() => {
      if (isMounted) void checkHealth();
    }, 30000);

    const clock = setInterval(() => {
      if (isMounted) {
        setUtcTime(new Date().toUTCString().slice(17, 25) + ' UTC');
      }
    }, 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      clearInterval(clock);
    };
  }, [checkHealth]);

  const handleNavClick = (id: Tab) => {
    setActiveTab(id);
    setSidebarOpen(false);
  };

  const handleRunDetections = async () => {
    try {
      setTriggeringAction('detection');
      const res = await apiClient.runDetections({ limit: 100, lookback_minutes: 1440 });
      setActionNotice(`Detection Run: Evaluated ${res.events_evaluated} events · Created ${res.alerts_created} alerts`);
      setTimeout(() => setActionNotice(null), 5000);
    } catch (e: any) {
      setActionNotice(`Detection Failed: ${e.message || 'Error executing rule engine'}`);
      setTimeout(() => setActionNotice(null), 5000);
    } finally {
      setTriggeringAction(null);
    }
  };

  const handleRunCorrelation = async () => {
    try {
      setTriggeringAction('correlation');
      const res = await apiClient.runCorrelation({});
      setActionNotice(`Correlation Run: Created ${res.incidents_created} incidents (${res.incidents_updated} updated)`);
      setTimeout(() => setActionNotice(null), 5000);
    } catch (e: any) {
      setActionNotice(`Correlation Failed: ${e.message || 'Error clustering alerts'}`);
      setTimeout(() => setActionNotice(null), 5000);
    } finally {
      setTriggeringAction(null);
    }
  };

  const activeNav = CORE_NAV_ITEMS.find((n) => n.id === activeTab) || CORE_NAV_ITEMS[0];

  return (
    <div className="app-container" style={{ background: '#060913', minHeight: '100vh', display: 'flex' }}>
      {/* Mobile Drawer Backdrop */}
      {sidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
      )}

      {/* CloudSentinel 2.0 Midnight Navy Sidebar */}
      <aside
        className={`sidebar ${sidebarOpen ? 'open' : ''}`}
        data-testid="sidebar"
        style={{
          width: 260,
          background: '#070b16',
          borderRight: '1px solid #1e293b',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}
      >
        {/* Brand Banner */}
        <div
          style={{
            padding: '1.25rem 1.25rem',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 0 14px rgba(6, 182, 212, 0.25)',
              flexShrink: 0,
            }}
          >
            <Shield size={22} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              CloudSentinel
            </div>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#06b6d4', letterSpacing: '0.08em', marginTop: '0.15rem' }}>
              SECURITY OPERATIONS
            </div>
          </div>
        </div>

        {/* Live SOC Monitor Bar */}
        <div style={{ padding: '0.65rem 1rem', borderBottom: '1px solid #1e293b' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.35rem 0.65rem',
              borderRadius: 6,
              background: '#0a0f1d',
              border: '1px solid #1e293b',
              fontSize: '0.72rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#10b981', fontWeight: 700 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
              SOC LIVE
            </div>
            <div style={{ color: '#64748b', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem' }}>
              {utcTime || 'ONLINE'}
            </div>
          </div>
        </div>

        {/* 9 Professional Navigation Items */}
        <nav className="sidebar-nav" style={{ flex: 1, padding: '0.75rem 0.5rem', overflowY: 'auto' }}>
          {(['PRIMARY OPERATIONS', 'ADVANCED TOOLS'] as const).map((cat) => (
            <div key={cat} style={{ marginBottom: '1rem' }}>
              <div
                style={{
                  fontSize: '0.64rem',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  color: '#475569',
                  padding: '0.35rem 0.85rem 0.25rem',
                }}
              >
                {cat}
              </div>
              {CORE_NAV_ITEMS.filter((n) => n.category === cat).map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    data-testid={`nav-tab-${item.id}`}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.55rem 0.85rem',
                      borderRadius: 6,
                      border: 'none',
                      background: isActive ? 'rgba(6, 182, 212, 0.12)' : 'transparent',
                      color: isActive ? '#06b6d4' : '#94a3b8',
                      fontWeight: isActive ? 600 : 500,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                      marginBottom: '0.15rem',
                      transition: 'background 0.15s, color 0.15s',
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = '#0d1422';
                        e.currentTarget.style.color = '#f1f5f9';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = '#94a3b8';
                      }
                    }}
                  >
                    {isActive && (
                      <span
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: '20%',
                          bottom: '20%',
                          width: 3,
                          borderRadius: 2,
                          background: '#06b6d4',
                        }}
                      />
                    )}
                    <span style={{ color: isActive ? '#06b6d4' : '#64748b' }}>{item.icon}</span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div style={{ padding: '1rem', borderTop: '1px solid #1e293b', fontSize: '0.72rem', color: '#64748b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontWeight: 600 }}>
            <span>CloudSentinel 2.0</span>
            <span style={{ color: '#06b6d4' }}>v0.1.0</span>
          </div>
          <div style={{ marginTop: '0.2rem' }}>FastAPI · PostgreSQL · React</div>
        </div>
      </aside>

      {/* Main Command Workspace */}
      <div className="main-wrapper" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Top Header Bar */}
        <header
          className="top-header"
          style={{
            height: 64,
            padding: '0 1.5rem',
            background: '#0a0f1d',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          {/* Breadcrumbs & Active Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="mobile-menu-btn"
              aria-label="Toggle navigation"
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#64748b' }}>
                <span>CloudSentinel</span>
                <ChevronRight size={14} />
                <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{activeNav.label}</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.1rem' }}>
                {SECTION_DESCRIPTIONS[activeTab] || 'Security workspace'}
              </div>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Quick Engine Actions */}
            <button
              className="btn btn-secondary"
              onClick={handleRunDetections}
              disabled={triggeringAction !== null}
              style={{ fontSize: '0.74rem', padding: '0.35rem 0.75rem', gap: '0.4rem' }}
              title="Execute rule evaluation across recent events"
            >
              <Play size={12} className={triggeringAction === 'detection' ? 'spin' : ''} style={{ color: '#06b6d4' }} />
              <span>{triggeringAction === 'detection' ? 'Evaluating...' : 'Run Detection'}</span>
            </button>

            <button
              className="btn btn-secondary"
              onClick={handleRunCorrelation}
              disabled={triggeringAction !== null}
              style={{ fontSize: '0.74rem', padding: '0.35rem 0.75rem', gap: '0.4rem' }}
              title="Correlate open alerts into incident clusters"
            >
              <Zap size={12} className={triggeringAction === 'correlation' ? 'spin' : ''} style={{ color: '#a855f7' }} />
              <span>{triggeringAction === 'correlation' ? 'Clustering...' : 'Correlate'}</span>
            </button>

            {/* Connection Status Pill */}
            <div
              className="connection-pill"
              data-testid="connection-status-pill"
              onClick={checkHealth}
              style={{ cursor: 'pointer', height: 32, padding: '0 0.75rem', fontSize: '0.75rem' }}
              title="Click to re-verify API and DB health"
            >
              <span
                className={`status-dot ${apiOnline === true ? 'online' : 'offline'}`}
                data-testid="connection-dot"
              />
              <span style={{ color: '#cbd5e1' }}>
                {getConnectionStatus(health, apiOnline)}
              </span>
            </div>
          </div>
        </header>

        {/* Action Notice Notification */}
        {actionNotice && (
          <div
            style={{
              padding: '0.65rem 1.5rem',
              background: 'rgba(6, 182, 212, 0.1)',
              borderBottom: '1px solid rgba(6, 182, 212, 0.3)',
              color: '#06b6d4',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <CheckCircle2 size={15} />
            <span>{actionNotice}</span>
          </div>
        )}

        {/* Main Content Workspace Body */}
        <main className="content-body" style={{ flex: 1, padding: '1.5rem', overflowY: 'auto' }}>
          {activeTab === 'overview' && <OverviewView onNavigateTab={handleNavClick} />}
          {activeTab === 'threats' && <SuspenseWrapper><ThreatDetectionView /></SuspenseWrapper>}
          {activeTab === 'events' && <EventsTable />}
          {activeTab === 'alerts' && <AlertsTable />}
          {activeTab === 'incidents' && <IncidentsTable />}
          {activeTab === 'rules' && <DetectionRulesView />}
          {activeTab === 'audit' && <SuspenseWrapper><AuditLogsView /></SuspenseWrapper>}
          {activeTab === 'integrations' && <SuspenseWrapper><IntegrationsView /></SuspenseWrapper>}
          {activeTab === 'settings' && <SuspenseWrapper><SettingsView /></SuspenseWrapper>}
          {activeTab === 'operations' && <SuspenseWrapper><OperationsView /></SuspenseWrapper>}
          {activeTab === 'investigate' && <SuspenseWrapper><InvestigationsView /></SuspenseWrapper>}
          {activeTab === 'assets' && <SuspenseWrapper><CloudAssetsView /></SuspenseWrapper>}
          {activeTab === 'aws' && <SuspenseWrapper><AWSMonitoringView /></SuspenseWrapper>}
          {activeTab === 'iam' && <SuspenseWrapper><IAMRiskView /></SuspenseWrapper>}
          {activeTab === 'network' && <SuspenseWrapper><NetworkView /></SuspenseWrapper>}
          {activeTab === 'cspm' && <SuspenseWrapper><CSPMView /></SuspenseWrapper>}
        </main>
      </div>
    </div>
  );
};

export default App;
