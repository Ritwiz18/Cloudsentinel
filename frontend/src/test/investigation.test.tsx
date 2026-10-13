import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IncidentInvestigationView } from '../components/incidents/IncidentInvestigationView';
import { apiClient } from '../api/client';
import type { InvestigationResponse } from '../types/api';

vi.mock('../api/client', () => ({
  apiClient: {
    investigateIncident: vi.fn(),
    getIncidentInvestigations: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

describe('AI-Assisted Investigation View Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockInvestigation: InvestigationResponse = {
    id: 1,
    investigation_id: 'inv-test-1234',
    incident_id: 'inc-actor-999',
    alert_id: null,
    summary: 'Root principal established open SSH access and attached administrative role.',
    observed_evidence: [
      'Verified Telemetry: ConsoleLogin by root without MFA from 198.51.100.42',
      "Rule Triggered: 'Unrestricted Ingress' on sg-012345",
    ],
    detection_explanation: 'Activity correlates root login with direct security group ingress weakening.',
    potential_impact: 'Unauthenticated remote administrative access to cloud workloads.',
    confidence_level: 'HIGH',
    confidence_limitations: 'Analysis bounded by ingested CloudTrail window; unmonitored regions excluded.',
    recommended_steps: [
      'Verify if root login was part of an approved emergency change window.',
      'Revoke active STS sessions for root immediately.',
      'Revert 0.0.0.0/0 ingress rule on port 22.',
    ],
    hypotheses: [
      '[Hypothesis 1: Credential Exposure] The root access keys were leaked via public repository.',
      '[Hypothesis 2: Unauthorized Operational Bypass] Engineer bypassed change management protocols.',
    ],
    evidence_references: {
      incident_id: 'inc-actor-999',
      alert_ids: ['alt-1', 'alt-2'],
      event_ids: ['evt-1', 'evt-2'],
      affected_resources: ['arn:aws:iam::123:root', 'sg-012345'],
      actors: ['root'],
      source_ips: ['198.51.100.42'],
    },
    provider: 'offline-rule-engine',
    model: 'deterministic-heuristics',
    created_at: '2026-10-12T18:00:00Z',
  };

  it('renders loading state while generating investigation', () => {
    vi.mocked(apiClient.investigateIncident).mockReturnValue(new Promise(() => {}));

    render(<IncidentInvestigationView incidentId="inc-actor-999" />);

    expect(screen.getByTestId('investigation-loading')).toBeInTheDocument();
    expect(screen.getByText('Synthesizing Security Telemetry & Evidence...')).toBeInTheDocument();
  });

  it('renders error state and handles retry click', async () => {
    vi.mocked(apiClient.investigateIncident)
      .mockRejectedValueOnce(new Error('Backend timeout'))
      .mockResolvedValueOnce(mockInvestigation);

    render(<IncidentInvestigationView incidentId="inc-actor-999" />);

    await waitFor(() => {
      expect(screen.getByTestId('investigation-error')).toBeInTheDocument();
    });
    expect(screen.getByText('Investigation Error')).toBeInTheDocument();

    // Click retry
    const retryBtn = screen.getByTestId('investigation-retry-btn');
    await userEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByTestId('investigation-results')).toBeInTheDocument();
    });
    expect(screen.getByText(/Root principal established open SSH access/i)).toBeInTheDocument();
  });

  it('renders observed evidence and AI-generated hypotheses in separate distinct cards', async () => {
    vi.mocked(apiClient.investigateIncident).mockResolvedValue(mockInvestigation);

    render(<IncidentInvestigationView incidentId="inc-actor-999" />);

    await waitFor(() => {
      expect(screen.getByTestId('investigation-results')).toBeInTheDocument();
    });

    // Verify separate cards
    expect(screen.getByTestId('observed-evidence-card')).toBeInTheDocument();
    expect(screen.getByTestId('hypotheses-card')).toBeInTheDocument();
    expect(screen.getByTestId('recommended-steps-card')).toBeInTheDocument();

    // Verify observed facts
    expect(screen.getByText(/ConsoleLogin by root without MFA/i)).toBeInTheDocument();

    // Verify hypotheses are explicitly separated
    expect(screen.getByText(/Hypothesis 1: Credential Exposure/i)).toBeInTheDocument();
    expect(screen.getByText(/Hypothesis 2: Unauthorized Operational Bypass/i)).toBeInTheDocument();

    // Verify recommended defensive steps
    expect(screen.getByText(/Revoke active STS sessions for root immediately/i)).toBeInTheDocument();

    // Verify provider and confidence
    expect(screen.getByText(/HIGH CONFIDENCE/i)).toBeInTheDocument();
    expect(screen.getByText(/offline-rule-engine/i)).toBeInTheDocument();
  });

  it('triggers force refresh when re-run button is clicked', async () => {
    vi.mocked(apiClient.investigateIncident).mockResolvedValue(mockInvestigation);

    render(<IncidentInvestigationView incidentId="inc-actor-999" />);

    await waitFor(() => {
      expect(screen.getByTestId('investigation-results')).toBeInTheDocument();
    });

    const rerunBtn = screen.getByTestId('refresh-investigation-btn');
    await userEvent.click(rerunBtn);

    expect(apiClient.investigateIncident).toHaveBeenCalledWith('inc-actor-999', {
      force_refresh: true,
    });
  });
});
