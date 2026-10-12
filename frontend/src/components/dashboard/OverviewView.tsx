import React, { useState, useEffect, useCallback } from 'react';
import { apiClient, ApiError } from '../../api/client';
import type { SecurityAlert, SecurityIncident } from '../../types/api';
import { MetricCards } from './MetricCards';
import { SeverityChart } from './SeverityChart';
import { RecentAlertsList } from './RecentAlertsList';
import { RecentIncidentsList } from './RecentIncidentsList';
import { ErrorState, LoadingState } from '../common/StateView';
import { AlertDetailDrawer } from '../alerts/AlertDetailDrawer';
import { IncidentDetailDrawer } from '../incidents/IncidentDetailDrawer';
import { RefreshCw } from 'lucide-react';

interface Props {
  onNavigateTab: (tab: 'events' | 'alerts' | 'incidents' | 'operations') => void;
}

export const OverviewView: React.FC<Props> = ({ onNavigateTab }) => {
  const [totalEvents, setTotalEvents] = useState(0);
  const [openIncidents, setOpenIncidents] = useState(0);
  const [openAlerts, setOpenAlerts] = useState(0);
  const [criticalHighAlerts, setCriticalHighAlerts] = useState(0);

  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedAlert, setSelectedAlert] = useState<SecurityAlert | null>(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

  const executeFetch = useCallback((isMountedRef?: { current: boolean }) => {
    return Promise.all([
      apiClient.getEvents({ limit: 1 }),
      apiClient.getIncidents({ limit: 5, status: 'OPEN' }),
      apiClient.getAlerts({ limit: 50 }),
      apiClient.getIncidents({ limit: 5 }),
    ])
      .then(([eventsData, openIncData, alertsData, allIncData]) => {
        if (isMountedRef && !isMountedRef.current) return;
        setTotalEvents(eventsData.total);
        setOpenIncidents(openIncData.total);
        setIncidents(allIncData.items);
        setAlerts(alertsData.items);

        const openAltCount = alertsData.items.filter((a) => a.status === 'OPEN').length;
        setOpenAlerts(openAltCount);

        const critHigh = alertsData.items.filter(
          (a) => a.severity === 'CRITICAL' || a.severity === 'HIGH'
        ).length;
        setCriticalHighAlerts(critHigh);
        setLoading(false);
      })
      .catch((err: any) => {
        if (isMountedRef && !isMountedRef.current) return;
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('Unable to load dashboard data. Ensure the backend service is running on port 8000.');
        }
        setLoading(false);
      });
  }, []);

  const loadDashboardData = useCallback(() => {
    setLoading(true);
    setError(null);
    void executeFetch();
  }, [executeFetch]);

  useEffect(() => {
    const isMountedRef = { current: true };
    void executeFetch(isMountedRef);
    return () => {
      isMountedRef.current = false;
    };
  }, [executeFetch]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} data-testid="overview-view-container">
      {/* Overview Header Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f1f5f9' }}>
            Security Operations Overview
          </h2>
          <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
            Real-time telemetry and correlation analytics from local PostgreSQL store
          </p>
        </div>
        <button
          className="btn btn-secondary"
          onClick={loadDashboardData}
          disabled={loading}
          aria-label="Refresh dashboard data"
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {loading ? (
        <LoadingState message="Fetching SOC metrics from CloudSentinel API..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadDashboardData} />
      ) : (
        <>
          {/* Key Metric Gauges */}
          <MetricCards
            totalEvents={totalEvents}
            openIncidents={openIncidents}
            openAlerts={openAlerts}
            criticalHighAlerts={criticalHighAlerts}
          />

          {/* Severity Distribution */}
          <SeverityChart alerts={alerts} />

          {/* Activity Feeds */}
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            <RecentAlertsList
              alerts={alerts}
              onSelectAlert={setSelectedAlert}
              onViewAll={() => onNavigateTab('alerts')}
            />
            <RecentIncidentsList
              incidents={incidents}
              onSelectIncident={(inc) => setSelectedIncidentId(inc.incident_id)}
              onViewAll={() => onNavigateTab('incidents')}
            />
          </div>
        </>
      )}

      {/* Inspect Drawers */}
      <AlertDetailDrawer alert={selectedAlert} onClose={() => setSelectedAlert(null)} />
      <IncidentDetailDrawer
        incidentId={selectedIncidentId}
        onClose={() => setSelectedIncidentId(null)}
        onIncidentUpdated={loadDashboardData}
      />
    </div>
  );
};
