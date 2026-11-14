import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OverviewView } from '../components/dashboard/OverviewView';
import { apiClient } from '../api/client';
import type { DashboardOverview } from '../types/api';

vi.mock('../api/client', () => ({
  apiClient: {
    getDashboardOverview: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

const overview = (overrides: Partial<DashboardOverview> = {}): DashboardOverview => ({
  total_events: 42,
  total_alerts: 1,
  total_incidents: 2,
  total_investigations: 0,
  alerts_by_severity: { CRITICAL: 1, HIGH: 0, MEDIUM: 0, LOW: 0, INFORMATIONAL: 0 },
  alerts_by_status: { OPEN: 1, INVESTIGATING: 0, RESOLVED: 0, FALSE_POSITIVE: 0 },
  incidents_by_status: { OPEN: 2, INVESTIGATING: 0, RESOLVED: 0, FALSE_POSITIVE: 0 },
  critical_high_alerts: 1,
  open_critical_high_alerts: 1,
  security_posture_score: 72,
  posture_grade: 'B',
  recent_events: [],
  recent_alerts: [
    {
      alert_id: 'alt-1',
      rule_name: 'IAM Admin Escalation',
      severity: 'CRITICAL',
      risk_score: 90,
      title: 'Admin policy attached',
      status: 'OPEN',
      first_seen: '2026-10-09T12:00:00Z',
      occurrence_count: 1,
    },
  ],
  recent_incidents: [
    {
      incident_id: 'inc-001',
      title: 'Critical IAM Role Escalation',
      severity: 'CRITICAL',
      risk_score: 95,
      status: 'OPEN',
      first_seen: '2026-10-09T12:00:00Z',
    },
  ],
  events_last_24h: 10,
  alerts_last_24h: 1,
  incidents_last_24h: 2,
  generated_at: '2026-10-09T12:00:00Z',
  ...overrides,
});

describe('Overview Dashboard View', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    vi.mocked(apiClient.getDashboardOverview).mockImplementation(() => new Promise(() => {}));

    render(<OverviewView onNavigateTab={vi.fn()} />);
    expect(screen.getByTestId('loading-state')).toBeInTheDocument();
  });

  it('renders metric cards and severity chart when API succeeds', async () => {
    vi.mocked(apiClient.getDashboardOverview).mockResolvedValue(overview());

    render(<OverviewView onNavigateTab={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('metric-events')).toBeInTheDocument();
    });

    expect(screen.getByText('42')).toBeInTheDocument(); // total events
    expect(screen.getByTestId('metric-incidents')).toHaveTextContent('2'); // open incidents
    expect(screen.getByTestId('severity-chart')).toBeInTheDocument();
    expect(screen.getByTestId('recent-alerts-card')).toHaveTextContent('Admin policy attached');
    expect(screen.getByTestId('recent-incidents-card')).toHaveTextContent('Critical IAM Role Escalation');
  });

  it('renders error state and retries on user click', async () => {
    vi.mocked(apiClient.getDashboardOverview).mockRejectedValueOnce(new Error('Connection refused'));

    render(<OverviewView onNavigateTab={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('error-state')).toBeInTheDocument();
    });

    // Mock success on retry
    vi.mocked(apiClient.getDashboardOverview).mockResolvedValueOnce(overview({ total_events: 10 }));
    const retryBtn = screen.getByRole('button', { name: /retry/i });
    await userEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByTestId('metric-events')).toBeInTheDocument();
    });
  });
});