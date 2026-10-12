import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from './api/client';
import { OverviewView } from './components/dashboard/OverviewView';
import { EventsTable } from './components/events/EventsTable';
import { AlertsTable } from './components/alerts/AlertsTable';
import { IncidentsTable } from './components/incidents/IncidentsTable';
import { OperationsView } from './components/operations/OperationsView';
import {
  Activity,
  AlertTriangle,
  Cpu,
  LayoutDashboard,
  Menu,
  Shield,
  ShieldAlert,
  X,
} from 'lucide-react';

type Tab = 'overview' | 'events' | 'alerts' | 'incidents' | 'operations';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);

  const checkHealth = useCallback(() => {
    apiClient.getHealth().then(
      () => setApiOnline(true),
      () => setApiOnline(false)
    );
  }, []);

  useEffect(() => {
    let isMounted = true;
    apiClient.getHealth().then(
      () => {
        if (isMounted) setApiOnline(true);
      },
      () => {
        if (isMounted) setApiOnline(false);
      }
    );

    const interval = setInterval(() => {
      apiClient.getHealth().then(
        () => {
          if (isMounted) setApiOnline(true);
        },
        () => {
          if (isMounted) setApiOnline(false);
        }
      );
    }, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const getPageTitle = () => {
    switch (activeTab) {
      case 'overview':
        return 'SOC Overview & Telemetry';
      case 'events':
        return 'Canonical Security Events';
      case 'alerts':
        return 'Persistent Threat Alerts';
      case 'incidents':
        return 'Correlated Incident Management';
      case 'operations':
        return 'Analyst & Development Operations';
      default:
        return 'CloudSentinel';
    }
  };

  return (
    <div className="app-container">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
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
          <button
            className={`nav-link ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('overview');
              setSidebarOpen(false);
            }}
            data-testid="nav-tab-overview"
          >
            <LayoutDashboard size={18} />
            <span>Overview</span>
          </button>

          <button
            className={`nav-link ${activeTab === 'events' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('events');
              setSidebarOpen(false);
            }}
            data-testid="nav-tab-events"
          >
            <Activity size={18} />
            <span>Security Events</span>
          </button>

          <button
            className={`nav-link ${activeTab === 'alerts' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('alerts');
              setSidebarOpen(false);
            }}
            data-testid="nav-tab-alerts"
          >
            <AlertTriangle size={18} />
            <span>Alerts</span>
          </button>

          <button
            className={`nav-link ${activeTab === 'incidents' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('incidents');
              setSidebarOpen(false);
            }}
            data-testid="nav-tab-incidents"
          >
            <ShieldAlert size={18} />
            <span>Incidents</span>
          </button>

          <button
            className={`nav-link ${activeTab === 'operations' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('operations');
              setSidebarOpen(false);
            }}
            data-testid="nav-tab-operations"
          >
            <Cpu size={18} />
            <span>Operations & Tools</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div>Local Dev Prototype</div>
          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>PostgreSQL • FastAPI • Vite</div>
        </div>
      </aside>

      {/* Main Content Layout */}
      <div className="main-wrapper">
        <header className="top-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle navigation menu"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#cbd5e1',
                cursor: 'pointer',
                display: 'none',
              }}
              className="mobile-menu-btn"
            >
              {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
            <h1 className="page-title">{getPageTitle()}</h1>
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
                {apiOnline === null
                  ? 'Connecting...'
                  : apiOnline
                  ? 'API: Connected (:8000)'
                  : 'API: Offline'}
              </span>
            </div>
          </div>
        </header>

        <main className="content-body">
          {activeTab === 'overview' && <OverviewView onNavigateTab={setActiveTab} />}
          {activeTab === 'events' && <EventsTable />}
          {activeTab === 'alerts' && <AlertsTable />}
          {activeTab === 'incidents' && <IncidentsTable />}
          {activeTab === 'operations' && <OperationsView />}
        </main>
      </div>
    </div>
  );
};

export default App;
