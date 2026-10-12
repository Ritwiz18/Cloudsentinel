import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EventsTable } from '../components/events/EventsTable';
import { AlertsTable } from '../components/alerts/AlertsTable';
import { apiClient } from '../api/client';

vi.mock('../api/client', () => ({
  apiClient: {
    getEvents: vi.fn(),
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

describe('Events and Alerts Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('EventsTable renders security events and marks synthetic ones', async () => {
    vi.mocked(apiClient.getEvents).mockResolvedValue({
      items: [
        {
          id: 1,
          event_id: 'evt-synth-101',
          source: 'simulator',
          event_type: 'Authentication',
          timestamp: '2026-10-09T14:00:00Z',
          actor: 'arn:aws:iam::123:user/test',
          source_ip: '198.51.100.1',
          resource: 'arn:aws:iam::123:role/dev',
          outcome: 'FAILURE',
          metadata: { is_synthetic: true, attempts: 5 },
          ingested_at: '2026-10-09T14:00:05Z',
        },
      ],
      total: 1,
      limit: 15,
      offset: 0,
    });

    render(<EventsTable />);

    await waitFor(() => {
      expect(screen.getByTestId('event-row-evt-synth-101')).toBeInTheDocument();
    });

    expect(screen.getByText('SYNTH')).toBeInTheDocument();
    expect(screen.getByText('evt-synth-101')).toBeInTheDocument();

    // Click row to open detail drawer
    await userEvent.click(screen.getByTestId('event-row-evt-synth-101'));

    await waitFor(() => {
      expect(screen.getByTestId('synthetic-event-banner')).toBeInTheDocument();
    });
    expect(screen.getByText(/Synthetic Simulation Event/)).toBeInTheDocument();
  });

  it('AlertsTable renders alert details with severity label and risk score', async () => {
    vi.mocked(apiClient.getAlerts).mockResolvedValue({
      items: [
        {
          id: 1,
          alert_id: 'alt-high-001',
          fingerprint: 'fp-auth-123',
          rule_id: 'AUTH-001',
          rule_name: 'Brute-Force Authentication Attempt',
          severity: 'HIGH',
          risk_score: 75,
          confidence: 0.9,
          title: 'Multiple Failed Authentication Attempts',
          description: '5 failed logins detected within 5 minutes',
          status: 'OPEN',
          related_event_ids: ['evt-1', 'evt-2'],
          evidence: { failure_count: 5, threshold: 5 },
          first_seen: '2026-10-09T14:00:00Z',
          last_seen: '2026-10-09T14:05:00Z',
          occurrence_count: 5,
          created_at: '2026-10-09T14:05:00Z',
          updated_at: '2026-10-09T14:05:00Z',
        },
      ],
      total: 1,
      limit: 15,
      offset: 0,
    });

    render(<AlertsTable />);

    await waitFor(() => {
      expect(screen.getByTestId('alert-row-alt-high-001')).toBeInTheDocument();
    });

    expect(screen.getByTestId('severity-badge-high')).toHaveTextContent('HIGH');
    expect(screen.getByText('75/100')).toBeInTheDocument();
    expect(screen.getByText('AUTH-001')).toBeInTheDocument();

    // Click row to open alert detail drawer
    await userEvent.click(screen.getByTestId('alert-row-alt-high-001'));

    await waitFor(() => {
      expect(screen.getByText('Diagnostic Evidence')).toBeInTheDocument();
    });
    expect(screen.getByText('evt-1')).toBeInTheDocument();
  });
});
