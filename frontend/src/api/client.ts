import type {
  AlertListResponse,
  CorrelationRunRequest,
  CorrelationRunResponse,
  DetectionRunRequest,
  DetectionRunResponse,
  EventListResponse,
  HealthResponse,
  IncidentDetail,
  IncidentListResponse,
  IncidentUpdateRequest,
  InvestigationCreateRequest,
  InvestigationListResponse,
  InvestigationResponse,
  SecurityAlert,
  SecurityEvent,
} from '../types/api';

export class ApiError extends Error {
  status: number;
  details?: any;

  constructor(status: number, message: string, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:8000';

let activeBaseUrl = API_BASE_URL;

export function getActiveBaseUrl(): string {
  return activeBaseUrl;
}

export function resetActiveBaseUrl(): void {
  activeBaseUrl = API_BASE_URL;
}

async function apiFetch(pathAndQuery: string, init?: RequestInit): Promise<Response> {
  const url = `${activeBaseUrl}${pathAndQuery}`;
  try {
    return init !== undefined ? await fetch(url, init) : await fetch(url);
  } catch (err: any) {
    // Transparent loopback fallback between localhost and 127.0.0.1 (resolves Windows IPv6/IPv4 mismatch)
    const alternate = activeBaseUrl.includes('localhost')
      ? activeBaseUrl.replace('localhost', '127.0.0.1')
      : activeBaseUrl.includes('127.0.0.1')
      ? activeBaseUrl.replace('127.0.0.1', 'localhost')
      : null;

    if (alternate) {
      try {
        const altUrl = `${alternate}${pathAndQuery}`;
        const res = init !== undefined ? await fetch(altUrl, init) : await fetch(altUrl);
        activeBaseUrl = alternate;
        return res;
      } catch {
        // Both endpoints failed, propagate original error
      }
    }
    throw err;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorDetail: any = null;
    let message = `API request failed with status ${res.status}`;
    try {
      const data = await res.json();
      errorDetail = data.detail || data;
      if (typeof errorDetail === 'string') {
        message = errorDetail;
      } else if (Array.isArray(errorDetail)) {
        // FastAPI validation errors (e.g., 422)
        message = errorDetail.map((err) => `${err.loc?.join('.') || 'param'}: ${err.msg}`).join('; ');
      } else if (errorDetail && typeof errorDetail === 'object' && errorDetail.message) {
        message = errorDetail.message;
      }
    } catch {
      // response wasn't JSON
      message = res.statusText || message;
    }
    throw new ApiError(res.status, message, errorDetail);
  }
  return res.json() as Promise<T>;
}

function buildQuery(params?: Record<string, any>): string {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== '') {
      searchParams.append(key, String(val));
    }
  }
  const str = searchParams.toString();
  return str ? `?${str}` : '';
}

export const apiClient = {
  async getHealth(): Promise<HealthResponse> {
    try {
      const res = await apiFetch('/health');
      return await handleResponse<HealthResponse>(res);
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(0, `Cannot reach CloudSentinel API at ${activeBaseUrl}. Ensure backend is running.`);
    }
  },

  async getEvents(params?: {
    limit?: number;
    offset?: number;
    event_type?: string;
    source?: string;
    outcome?: string;
  }): Promise<EventListResponse> {
    const q = buildQuery(params);
    const res = await apiFetch(`/api/v1/events${q}`);
    return handleResponse<EventListResponse>(res);
  },

  async getEventById(eventId: string): Promise<SecurityEvent> {
    const res = await apiFetch(`/api/v1/events/${encodeURIComponent(eventId)}`);
    return handleResponse<SecurityEvent>(res);
  },

  async getAlerts(params?: {
    limit?: number;
    offset?: number;
    severity?: string;
    rule_id?: string;
    status?: string;
  }): Promise<AlertListResponse> {
    const q = buildQuery(params);
    const res = await apiFetch(`/api/v1/alerts${q}`);
    return handleResponse<AlertListResponse>(res);
  },

  async getAlertById(alertId: string): Promise<SecurityAlert> {
    const res = await apiFetch(`/api/v1/alerts/${encodeURIComponent(alertId)}`);
    return handleResponse<SecurityAlert>(res);
  },

  async runDetections(req?: DetectionRunRequest): Promise<DetectionRunResponse> {
    const res = await apiFetch('/api/v1/detections/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req || {}),
    });
    return handleResponse<DetectionRunResponse>(res);
  },

  async getIncidents(params?: {
    limit?: number;
    offset?: number;
    status?: string;
    severity?: string;
    assigned_analyst?: string;
  }): Promise<IncidentListResponse> {
    const q = buildQuery(params);
    const res = await apiFetch(`/api/v1/incidents${q}`);
    return handleResponse<IncidentListResponse>(res);
  },

  async getIncidentById(incidentId: string): Promise<IncidentDetail> {
    const res = await apiFetch(`/api/v1/incidents/${encodeURIComponent(incidentId)}`);
    return handleResponse<IncidentDetail>(res);
  },

  async getIncidentAlerts(incidentId: string): Promise<SecurityAlert[]> {
    const res = await apiFetch(`/api/v1/incidents/${encodeURIComponent(incidentId)}/alerts`);
    return handleResponse<SecurityAlert[]>(res);
  },

  async updateIncident(incidentId: string, payload: IncidentUpdateRequest): Promise<IncidentDetail> {
    const res = await apiFetch(`/api/v1/incidents/${encodeURIComponent(incidentId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<IncidentDetail>(res);
  },

  async runCorrelation(req?: CorrelationRunRequest): Promise<CorrelationRunResponse> {
    const res = await apiFetch('/api/v1/incidents/correlate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req || {}),
    });
    return handleResponse<CorrelationRunResponse>(res);
  },

  async investigateIncident(
    incidentId: string,
    req?: InvestigationCreateRequest
  ): Promise<InvestigationResponse> {
    const res = await apiFetch(`/api/v1/incidents/${encodeURIComponent(incidentId)}/investigate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req || {}),
    });
    return handleResponse<InvestigationResponse>(res);
  },

  async getIncidentInvestigations(
    incidentId: string
  ): Promise<InvestigationListResponse> {
    const res = await apiFetch(`/api/v1/incidents/${encodeURIComponent(incidentId)}/investigations`);
    return handleResponse<InvestigationListResponse>(res);
  },

  async getInvestigationById(
    investigationId: string
  ): Promise<InvestigationResponse> {
    const res = await apiFetch(`/api/v1/investigations/${encodeURIComponent(investigationId)}`);
    return handleResponse<InvestigationResponse>(res);
  },
};
