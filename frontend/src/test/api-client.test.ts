import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { apiClient, ApiError, resetActiveBaseUrl } from '../api/client';

describe('API Client', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    resetActiveBaseUrl();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('getHealth returns server health status on success', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'healthy',
        service: 'cloudsentinel-api',
        timestamp: '2026-10-09T18:00:00Z',
        version: '0.1.0',
      }),
    });

    const res = await apiClient.getHealth();
    expect(res.status).toBe('healthy');
    expect(res.service).toBe('cloudsentinel-api');
    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:8000/health');
  });

  it('getHealth throws ApiError with descriptive message when network fails', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

    await expect(apiClient.getHealth()).rejects.toThrow(ApiError);
  });

  it('getEvents passes query filters properly', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [],
        total: 0,
        limit: 10,
        offset: 0,
      }),
    });

    await apiClient.getEvents({
      limit: 10,
      offset: 0,
      event_type: 'Authentication',
      outcome: 'FAILURE',
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/events?limit=10&offset=0&event_type=Authentication&outcome=FAILURE'
    );
  });

  it('updateIncident sends PATCH with JSON body and parses result', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 1,
        incident_id: 'inc-test-001',
        title: 'Brute force auth',
        summary: 'Multiple failed logins',
        severity: 'HIGH',
        risk_score: 75,
        status: 'RESOLVED',
        correlation_fingerprint: 'INC:actor:123',
        related_alert_ids: ['alt-1'],
        related_event_ids: ['evt-1'],
        correlation_reasons: ['Same actor'],
        first_seen: '2026-10-09T15:00:00Z',
        last_seen: '2026-10-09T15:30:00Z',
        assigned_analyst: 'analyst-1',
        resolution_reason: 'Password reset',
        created_at: '2026-10-09T15:00:00Z',
        updated_at: '2026-10-09T15:35:00Z',
        audits: [],
      }),
    });

    const res = await apiClient.updateIncident('inc-test-001', {
      status: 'RESOLVED',
      resolution_reason: 'Password reset',
    });

    expect(res.status).toBe('RESOLVED');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/incidents/inc-test-001',
      expect.objectContaining({
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  it('handles 422 Unprocessable Content and formats validation errors', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({
        detail: 'Resolution reason is required when marking incident as RESOLVED',
      }),
    });

    await expect(
      apiClient.updateIncident('inc-test-001', { status: 'RESOLVED' })
    ).rejects.toThrow('Resolution reason is required');
  });

  it('handles 404 Not Found error properly', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({
        detail: "Security alert with ID 'alt-missing' was not found.",
      }),
    });

    await expect(apiClient.getAlertById('alt-missing')).rejects.toThrow(
      "Security alert with ID 'alt-missing' was not found."
    );
  });

  it('falls back to 127.0.0.1 when localhost fails to connect', async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('Connection refused on localhost:8000'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'healthy',
          service: 'cloudsentinel-api',
          timestamp: '2026-10-09T18:00:00Z',
          version: '0.1.0',
        }),
      });

    const res = await apiClient.getHealth();
    expect(res.status).toBe('healthy');
    expect(globalThis.fetch).toHaveBeenNthCalledWith(1, 'http://localhost:8000/health');
    expect(globalThis.fetch).toHaveBeenNthCalledWith(2, 'http://127.0.0.1:8000/health');
  });
});
