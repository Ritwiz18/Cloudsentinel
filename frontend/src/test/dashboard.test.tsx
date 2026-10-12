import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OverviewView } from '../components/dashboard/OverviewView';
import { apiClient } from '../api/client';

vi.mock('../api/client', () => ({
  apiClient: {
    getEvents: vi.fn(),
    getIncidents: vi.fn(),
    getAlerts: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

describe('Overview Dashboard View', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    vi.mocked(apiClient.getEvents).mockImplementation(() => new Promise(() => {}));
    vi.mocked(apiClient.getIncidents).mockImplementation(() => new Promise(() => {}));
    vi.mocked(apiClient.getAlerts).mockImplementation(() => new Promise(() => {}));

    render(<OverviewView onNavigateTab={vi.fn()} />);
    expect(screen.getByTestId('loading-state')).toBeInTheDocument();
  });

  it('renders metric cards and severity chart when API succeeds', async () => {
    vi.mocked(apiClient.getEvents).mockResolvedValue({
      items: [],
      total: 42,
      limit: 1,
      offset: 0,
    });
    vi.mocked(apiClient.getIncidents)
      .mockResolvedValueOnce({
        items: [],
        total: 2,
        limit: 5,
        offset: 0,
      }) // open incidents
      .mockResolvedValueOnce({
        items: [
          {
            id: 1,
            incident_id: 'inc-001',
            title: 'Critical IAM Role Escalation',
            summary: 'Wildcard AssumeRole discovered',
            severity: 'CRITICAL',
            risk_score: 95,
            status: 'OPEN',
            correlation_fingerprint: 'INC:actor:1',
            related_alert_ids: ['alt-1'],
            related_event_ids: ['evt-1'],
            correlation_reasons: ['Root actor activity'],
            first_seen: '2026-10-09T12:00:00Z',
            last_seen: '2026-10-09T12:30:00Z',
            created_at: '2026-10-09T12:00:00Z',
            updated_at: '2026-10-09T12:30:00Z',
          },
        ],
        total: 2,
        limit: 5,
        offset: 0,
      }); // all recent incidents

    vi.mocked(apiClient.getAlerts).mockResolvedValue({
      items: [
        {
          id: 1,
          alert_id: 'alt-1',
          fingerprint: 'fp-1',
          rule_id: 'IAM-001',
          rule_name: 'IAM Admin Escalation',
          severity: 'CRITICAL',
          risk_score: 90,
          confidence: 0.95,
          title: 'Admin policy attached',
          description: 'AdministratorAccess policy attached',
          status: 'OPEN',
          related_event_ids: ['evt-1'],
          evidence: {},
          first_seen: '2026-10-09T12:00:00Z',
          last_seen: '2026-10-09T12:30:00Z',
          occurrence_count: 1,
          created_at: '2026-10-09T12:00:00Z',
          updated_at: '2026-10-09T12:30:00Z',
        },
      ],
      total: 1,
      limit: 50,
      offset: 0,
    });

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
    vi.mocked(apiClient.getEvents).mockRejectedValueOnce(new Error('Connection refused'));
    vi.mocked(apiClient.getIncidents).mockResolvedValue({ items: [], total: 0, limit: 5, offset: 0 });
    vi.mocked(apiClient.getAlerts).mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 });

    render(<OverviewView onNavigateTab={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('error-state')).toBeInTheDocument();
    });

    // Mock success on retry
    vi.mocked(apiClient.getEvents).mockResolvedValueOnce({ items: [], total: 10, limit: 1, offset: 0 });
    const retryBtn = screen.getByRole('button', { name: /retry/i });
    await userEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByTestId('metric-events')).toBeInTheDocument();
    });
  });
});
