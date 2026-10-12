import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IncidentsTable } from '../components/incidents/IncidentsTable';
import { IncidentStatusModal } from '../components/incidents/IncidentStatusModal';
import { apiClient } from '../api/client';
import type { IncidentDetail } from '../types/api';

vi.mock('../api/client', () => ({
  apiClient: {
    getIncidents: vi.fn(),
    getIncidentById: vi.fn(),
    getIncidentAlerts: vi.fn(),
    updateIncident: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

describe('Incidents Component & Lifecycle Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockIncident: IncidentDetail = {
    id: 1,
    incident_id: 'inc-actor-999',
    title: 'Suspicious CloudTrail Activity',
    summary: 'Correlated 3 high-risk alerts under actor dev-admin',
    severity: 'HIGH',
    risk_score: 80,
    status: 'OPEN',
    correlation_fingerprint: 'INC:actor:123:dev-admin',
    related_alert_ids: ['alt-1', 'alt-2'],
    related_event_ids: ['evt-1', 'evt-2', 'evt-3'],
    correlation_reasons: ['Shared actor ARN within 60 min'],
    first_seen: '2026-10-09T10:00:00Z',
    last_seen: '2026-10-09T10:45:00Z',
    assigned_analyst: 'alice',
    resolution_reason: null,
    created_at: '2026-10-09T10:00:00Z',
    updated_at: '2026-10-09T10:45:00Z',
    audits: [
      {
        id: 1,
        incident_id: 'inc-actor-999',
        action: 'CORRELATION_CREATED',
        actor: 'system',
        reason: 'Initial cluster created',
        created_at: '2026-10-09T10:00:00Z',
      },
    ],
  };

  it('renders IncidentsTable and opens drawer with correlated alerts and audit trail', async () => {
    vi.mocked(apiClient.getIncidents).mockResolvedValue({
      items: [mockIncident],
      total: 1,
      limit: 15,
      offset: 0,
    });
    vi.mocked(apiClient.getIncidentById).mockResolvedValue(mockIncident);
    vi.mocked(apiClient.getIncidentAlerts).mockResolvedValue([
      {
        id: 1,
        alert_id: 'alt-1',
        fingerprint: 'fp-1',
        rule_id: 'IAM-001',
        rule_name: 'IAM Policy Alteration',
        severity: 'HIGH',
        risk_score: 75,
        confidence: 0.9,
        title: 'Full admin access granted',
        description: 'Policy attached',
        status: 'OPEN',
        related_event_ids: ['evt-1'],
        evidence: {},
        first_seen: '2026-10-09T10:00:00Z',
        last_seen: '2026-10-09T10:15:00Z',
        occurrence_count: 1,
        created_at: '2026-10-09T10:15:00Z',
        updated_at: '2026-10-09T10:15:00Z',
      },
    ]);

    render(<IncidentsTable />);

    await waitFor(() => {
      expect(screen.getByTestId('incident-row-inc-actor-999')).toBeInTheDocument();
    });

    expect(screen.getByText('inc-actor-999')).toBeInTheDocument();
    expect(screen.getByText('alice')).toBeInTheDocument();

    // Click row to open detail drawer
    await userEvent.click(screen.getByTestId('incident-row-inc-actor-999'));

    await waitFor(() => {
      expect(screen.getByText('Full admin access granted')).toBeInTheDocument();
    });
    expect(screen.getByTestId('audit-entry-1')).toHaveTextContent('CORRELATION_CREATED');
  });

  it('IncidentStatusModal enforces non-empty resolution reason when transitioning to RESOLVED', async () => {
    const handleSuccess = vi.fn();
    const handleClose = vi.fn();

    render(
      <IncidentStatusModal
        incident={mockIncident}
        isOpen={true}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />
    );

    // Change status to RESOLVED
    const statusSelect = screen.getByTestId('status-select');
    await userEvent.selectOptions(statusSelect, 'RESOLVED');

    // Resolution reason field should appear
    expect(screen.getByTestId('resolution-reason-input')).toBeInTheDocument();

    // Attempt to submit with empty resolution reason
    const submitBtn = screen.getByTestId('save-status-btn');
    await userEvent.click(submitBtn);

    // Error banner should be displayed and updateIncident should NOT be called
    expect(screen.getByTestId('status-modal-error')).toHaveTextContent(
      'A resolution reason is mandatory when transitioning incident to RESOLVED.'
    );
    expect(apiClient.updateIncident).not.toHaveBeenCalled();

    // Now fill in the resolution reason
    const reasonInput = screen.getByTestId('resolution-reason-input');
    await userEvent.type(reasonInput, 'Credentials revoked and quarantined');

    vi.mocked(apiClient.updateIncident).mockResolvedValue({
      ...mockIncident,
      status: 'RESOLVED',
      resolution_reason: 'Credentials revoked and quarantined',
    });

    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(apiClient.updateIncident).toHaveBeenCalledWith('inc-actor-999', {
        status: 'RESOLVED',
        assigned_analyst: 'alice',
        resolution_reason: 'Credentials revoked and quarantined',
        change_reason: undefined,
      });
    });

    expect(handleSuccess).toHaveBeenCalled();
    expect(handleClose).toHaveBeenCalled();
  });
});
