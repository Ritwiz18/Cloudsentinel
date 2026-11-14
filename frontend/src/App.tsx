import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import type { HealthResponse, Tab } from './types/api';
import { apiClient } from './api/client';
import { LoadingState } from './components/common/StateView';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Cloud,
  Cpu,
  Database,
  LayoutDashboard,
  Link,
  Menu,
  Network,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  User,
  X,
  Zap,
} from 'lucide-react';

// Eager-load tabs that are almost always viewed first
import { OverviewView } from './components/dashboard/OverviewView';
import { EventsTable } from './components/events/EventsTable';
import { AlertsTable } from './components/alerts/AlertsTable';
import { IncidentsTable } from './components/incidents/IncidentsTable';

// Lazy-load less-frequently accessed views to keep initial bundle lean
const OperationsView = lazy(() =>
  import('./components/operations/OperationsView').then((m) => ({ default: m.OperationsView }))
);
const ThreatDetectionView = lazy(() =>
  import('./components/threats/ThreatDetectionView').then((m) => ({ default: m.ThreatDetectionView }))
);
const AuditLogsView = lazy(() =>
  import('./components/audit/AuditLogsView').then((m) => ({ default: m.AuditLogsView }))
);
const IntegrationsView = lazy(() =>
  import('./components/integrations/IntegrationsView').then((m) => ({ default: m.IntegrationsView }))
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
const SettingsView = lazy(() =>
  import('./components/settings/SettingsView').then((m) => ({ default: m.SettingsView }))
);
const InvestigationsView = lazy(() =>
  import('./components/investigations/InvestigationsView').then((m) => ({ default: m.InvestigationsView }))
);
const AWSMonitoringView = lazy(() =>
  import('./components/operations/AWSMonitoringView').then((m) => ({ default: m.AWSMonitoringView }))
);

interface NavItem {
  id: Tab;
  label: string;
  icon: React.ReactNode;
  group?: string;
}

const NAV_ITEMS: NavItem[] = [
  // Core
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={17} />, group: 'SOC' },
  { id: 'threats', label: 'Threat Detection', icon: <ShieldAlert size={17} />, group: 'SOC' },
  { id: 'alerts', label: 'Security Alerts', icon: <AlertTriangle size={17} />, group: 'SOC' },
  { id: 'incidents', label: 'Incident Management', icon: <Zap size={17} />, group: 'SOC' },
  { id: 'investigate', label: 'AI Investigation', icon: <BarChart3 size={17} />, group: 'SOC' },
  // Cloud
  { id: 'assets', label: 'Cloud Assets', icon: <Database size={17} />, group: 'Cloud' },
  { id: 'aws', label: 'AWS Monitoring', icon: <Cloud size={17} />, group: 'Cloud' },
  { id: 'iam', label: 'IAM Risk Analysis', icon: <User size={17} />, group: 'Cloud' },
  { id: 'network', label: 'Network Monitoring', icon: <Network size={17} />, group: 'Cloud' },
  { id: 'cspm', label: 'CSPM', icon: <ShieldCheck size={17} />, group: 'Cloud' },
  // Platform
  { id: 'events', label: 'Security Events', icon: <Activity size={17} />, group: 'Platform' },
  { id: 'audit', label: 'Audit Logs', icon: <BookOpen size={17} />, group: 'Platform' },
  { id: 'integrations', label: 'Integrations', icon: <Link size={17} />, group: 'Platform' },
  { id: 'operations', label: 'Operations', icon: <Cpu size={17} />, group: 'Platform' },
  { id: 'settings', label: 'Settings', icon: <Settings size={17} />, group: 'Platform' },
];

const PAGE_TITLES: Record<Tab, string> = {
  overview: 'SOC Overview',
  threats: 'Threat Detection',
  alerts: 'Security Alerts',
  incidents: 'Incident Management',
  assets: 'Cloud Asset Inventory',
  aws: 'AWS Security Monitoring',
  iam: 'IAM Risk Analysis',
  network: 'Network Monitoring',
  cspm: 'Cloud Security Posture Management',
  investigate: 'AI Investigation',
  events: 'Security Events',
  audit: 'Audit Logs',
  integrations: 'Integrations',
  operations: 'Operations & Tools',
  settings: 'Settings & Configuration',
};

function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingState message="Loading module..." />}>{children}</Suspense>;
}

function getConnectionStatus(health: HealthResponse | null, online: boolean | null): string {
  if (online === null) return 'Connecting...';
  if (online) {
    // API is reachable; if DB is unavailable surface a subtle degraded notice
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

  const checkHealth = useCallback(async () => {
    try {
      const h = await apiClient.getHealth();
      setHealth(h);
      // Reachability only: a degraded database stays visible in the pill label
      // ("API: Connected (DB offline)") instead of falsely reporting "API: Offline".
      setApiOnline(true);
    } catch {
      setHealth(null);
      setApiOnline(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    void checkHealth();
    const interval = setInterval(async () => {
      if (isMounted) void checkHealth();
    }, 30000);
    return () => { isMounted = false; clearInterval(interval); };
  }, [checkHealth]);

  const handleNavClick = (id: Tab) => {
    setActiveTab(id);
    setSidebarOpen(false);
  };

  // Group nav items by group label
  const groups = Array.from(new Set(NAV_ITEMS.map((n) => n.group)));

  return (
    <div className="app-container">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
      )}

      {/* Sidebar Navigation */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} data-testid="sidebar">
        <div className="sidebar-header">
          <div className="brand-icon">
            <Shield size={22} />
          </div>
          <div>
            <div className="brand-title">CloudSentinel</div>
            <div className="brand-subtitle">SOC PLATFORM</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {groups.map((group) => (
            <div key={group} style={{ marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#334155', padding: '0.5rem 1rem 0.3rem' }}>
                {group}
              </div>
              {NAV_ITEMS.filter((n) => n.group === group).map((item) => (
                <button
                  key={item.id}
                  className={`nav-link ${activeTab === item.id ? 'active' : ''}`}
                  onClick={() => handleNavClick(item.id)}
                  data-testid={`nav-tab-${item.id}`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div>CloudSentinel v0.1.0</div>
          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>PostgreSQL · FastAPI · React</div>
        </div>
      </aside>

      {/* Main Content Layout */}
      <div className="main-wrapper">
        <header className="top-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle navigation menu"
              style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer' }}
              className="mobile-menu-btn"
            >
              {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
            <h1 className="page-title">{PAGE_TITLES[activeTab]}</h1>
          </div>

          <div className="header-actions">
            <div
              className="connection-pill"
              data-testid="connection-status-pill"
              onClick={checkHealth}
              style={{ cursor: 'pointer' }}
              title="Click to refresh connection status"
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

        <main className="content-body">
          {activeTab === 'overview' && <OverviewView onNavigateTab={handleNavClick} />}
          {activeTab === 'events' && <EventsTable />}
          {activeTab === 'alerts' && <AlertsTable />}
          {activeTab === 'incidents' && <IncidentsTable />}
          {activeTab === 'threats' && <SuspenseWrapper><ThreatDetectionView /></SuspenseWrapper>}
          {activeTab === 'audit' && <SuspenseWrapper><AuditLogsView /></SuspenseWrapper>}
          {activeTab === 'integrations' && <SuspenseWrapper><IntegrationsView /></SuspenseWrapper>}
          {activeTab === 'assets' && <SuspenseWrapper><CloudAssetsView /></SuspenseWrapper>}
          {activeTab === 'iam' && <SuspenseWrapper><IAMRiskView /></SuspenseWrapper>}
          {activeTab === 'network' && <SuspenseWrapper><NetworkView /></SuspenseWrapper>}
          {activeTab === 'cspm' && <SuspenseWrapper><CSPMView /></SuspenseWrapper>}
          {activeTab === 'settings' && <SuspenseWrapper><SettingsView /></SuspenseWrapper>}
          {activeTab === 'operations' && <SuspenseWrapper><OperationsView /></SuspenseWrapper>}
          {activeTab === 'investigate' && (
            <SuspenseWrapper>
              <InvestigationsView />
            </SuspenseWrapper>
          )}
          {activeTab === 'aws' && (
            <SuspenseWrapper>
              <AWSMonitoringView />
            </SuspenseWrapper>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
