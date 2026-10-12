import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { OperationsView } from '../components/operations/OperationsView';
import { apiClient } from '../api/client';

vi.mock('../api/client', () => ({
  apiClient: {
    getHealth: vi.fn(),
    getEvents: vi.fn(),
    getIncidents: vi.fn(),
    getAlerts: vi.fn(),
    runDetections: vi.fn(),
    runCorrelation: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

describe('Navigation and Operations Controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('App navigation switches between tabs and shows API connection state', async () => {
    vi.mocked(apiClient.getHealth).mockResolvedValue({
      status: 'healthy',
      service: 'cloudsentinel-api',
      timestamp: '2026-10-09T12:00:00Z',
      version: '0.1.0',
    });
    vi.mocked(apiClient.getEvents).mockResolvedValue({ items: [], total: 0, limit: 1, offset: 0 });
    vi.mocked(apiClient.getIncidents).mockResolvedValue({ items: [], total: 0, limit: 5, offset: 0 });
    vi.mocked(apiClient.getAlerts).mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('connection-status-pill')).toHaveTextContent('API: Connected (:8000)');
    });

    // Navigate to Events tab
    const eventsNav = screen.getByTestId('nav-tab-events');
    await userEvent.click(eventsNav);
    expect(screen.getByTestId('events-page-container')).toBeInTheDocument();

    // Navigate to Alerts tab
    const alertsNav = screen.getByTestId('nav-tab-alerts');
    await userEvent.click(alertsNav);
    expect(screen.getByTestId('alerts-page-container')).toBeInTheDocument();

    // Navigate to Operations tab
    const opsNav = screen.getByTestId('nav-tab-operations');
    await userEvent.click(opsNav);
    expect(screen.getByTestId('operations-page-container')).toBeInTheDocument();
  });

  it('OperationsView shows confirmation modal and prevents duplicate submission while running', async () => {
    let resolveDetection: any;
    const pendingPromise = new Promise<any>((resolve) => {
      resolveDetection = resolve;
    });
    vi.mocked(apiClient.runDetections).mockImplementation(() => pendingPromise);

    render(<OperationsView />);

    const runBtn = screen.getByTestId('trigger-detection-btn');
    await userEvent.click(runBtn);

    // Confirmation modal should appear
    expect(screen.getByText('Confirm Threat Detection Run')).toBeInTheDocument();

    // Confirm execution
    const confirmBtn = screen.getByTestId('confirm-detection-action');
    await userEvent.click(confirmBtn);

    // Button should now be disabled to prevent duplicate submissions
    expect(runBtn).toBeDisabled();
    expect(runBtn).toHaveTextContent(/Evaluating Detection Rules/);

    // Resolve promise
    resolveDetection({
      events_evaluated: 50,
      alerts_created: 3,
      alerts_updated: 1,
      rules_evaluated: 5,
      errors: [],
    });

    await waitFor(() => {
      expect(screen.getByTestId('detection-result-card')).toBeInTheDocument();
    });

    expect(screen.getByText('Detection Run Completed Successfully')).toBeInTheDocument();
    expect(runBtn).not.toBeDisabled();
  });
});
