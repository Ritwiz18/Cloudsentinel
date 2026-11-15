// Extended API types for expanded CloudSentinel dashboard
export type SeverityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';
export type IncidentStatusLevel = 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'FALSE_POSITIVE';
export type AlertStatusLevel = 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'FALSE_POSITIVE';

// Shared navigation tab identifier (used by the app shell and dashboard views)
export type Tab =
  | 'overview'
  | 'command-center'
  | 'threats'
  | 'events'
  | 'alerts'
  | 'incidents'
  | 'rules'
  | 'audit'
  | 'integrations'
  | 'settings'
  | 'operations'
  | 'investigate'
  | 'assets'
  | 'aws'
  | 'iam'
  | 'network'
  | 'cspm';

export interface HealthEngines {
  detection?: { provider: string; rules: string[] };
  investigation?: { provider: string; model: string };
}

export interface HealthResponse {
  status: string;
  database: string;
  service: string;
  timestamp: string;
  version: string;
  engines?: HealthEngines;
}

export interface SecurityEvent {
  id: number;
  event_id: string;
  source: string;
  event_type: string;
  timestamp: string;
  account_id?: string | null;
  region?: string | null;
  actor?: string | null;
  source_ip?: string | null;
  resource?: string | null;
  outcome: string;
  metadata: Record<string, any>;
  ingested_at: string;
}

export interface EventListResponse {
  items: SecurityEvent[];
  total: number;
  limit: number;
  offset: number;
}

export interface SecurityAlert {
  id: number;
  alert_id: string;
  fingerprint: string;
  rule_id: string;
  rule_name: string;
  severity: SeverityLevel;
  risk_score: number;
  confidence: number;
  title: string;
  description: string;
  status: AlertStatusLevel;
  related_event_ids: string[];
  evidence: Record<string, any>;
  first_seen: string;
  last_seen: string;
  occurrence_count: number;
  created_at: string;
  updated_at: string;
}

export interface AlertListResponse {
  items: SecurityAlert[];
  total: number;
  limit: number;
  offset: number;
}

export interface IncidentAudit {
  id: number;
  incident_id: string;
  action: string;
  previous_state?: Record<string, any> | null;
  new_state?: Record<string, any> | null;
  actor?: string | null;
  reason?: string | null;
  created_at: string;
}

export interface SecurityIncident {
  id: number;
  incident_id: string;
  title: string;
  summary: string;
  severity: SeverityLevel;
  risk_score: number;
  status: IncidentStatusLevel;
  correlation_fingerprint: string;
  related_alert_ids: string[];
  related_event_ids: string[];
  correlation_reasons: string[];
  first_seen: string;
  last_seen: string;
  assigned_analyst?: string | null;
  resolution_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface IncidentDetail extends SecurityIncident {
  audits: IncidentAudit[];
}

export interface IncidentListResponse {
  items: SecurityIncident[];
  total: number;
  limit: number;
  offset: number;
}

export interface IncidentUpdateRequest {
  status?: IncidentStatusLevel;
  assigned_analyst?: string;
  resolution_reason?: string;
  change_reason?: string;
}

export interface DetectionRunRequest {
  limit?: number;
  lookback_minutes?: number;
  real_only?: boolean;
  auth_threshold?: number;
  auth_window_minutes?: number;
}

export interface DetectionRunResponse {
  events_evaluated: number;
  alerts_created: number;
  alerts_updated: number;
  rules_evaluated: number;
  errors: string[];
}

export interface CorrelationRunRequest {
  lookback_minutes?: number;
  window_minutes?: number;
  status_filter?: string;
}

export interface CorrelationRunResponse {
  alerts_evaluated: number;
  incidents_created: number;
  incidents_updated: number;
  errors: string[];
}

export interface ApiFilterParams {
  limit?: number;
  offset?: number;
  [key: string]: any;
}

export interface InvestigationResponse {
  id: number;
  investigation_id: string;
  incident_id?: string | null;
  alert_id?: string | null;
  summary: string;
  observed_evidence: string[];
  detection_explanation: string;
  potential_impact: string;
  confidence_level: 'HIGH' | 'MEDIUM' | 'LOW' | string;
  confidence_limitations: string;
  recommended_steps: string[];
  hypotheses: string[];
  evidence_references: {
    incident_id?: string;
    alert_ids?: string[];
    event_ids?: string[];
    affected_resources?: string[];
    actors?: string[];
    source_ips?: string[];
    [key: string]: any;
  };
  provider: string;
  model: string;
  created_at: string;
}

export interface InvestigationListResponse {
  items: InvestigationResponse[];
  total: number;
}

export interface InvestigationCreateRequest {
  force_refresh?: boolean;
  analyst_notes?: string;
}

// --- Dashboard Overview ---
export interface SeverityCount {
  CRITICAL: number;
  HIGH: number;
  MEDIUM: number;
  LOW: number;
  INFORMATIONAL: number;
}

export interface StatusCount {
  OPEN: number;
  INVESTIGATING: number;
  RESOLVED: number;
  FALSE_POSITIVE: number;
}

export interface DashboardRecentEvent {
  event_id: string;
  source: string;
  event_type: string;
  outcome: string;
  actor?: string | null;
  region?: string | null;
  timestamp: string;
  ingested_at: string;
}

export interface DashboardRecentAlert {
  alert_id: string;
  rule_name: string;
  severity: SeverityLevel;
  risk_score: number;
  title: string;
  status: AlertStatusLevel;
  first_seen: string;
  occurrence_count: number;
}

export interface DashboardRecentIncident {
  incident_id: string;
  title: string;
  severity: SeverityLevel;
  risk_score: number;
  status: IncidentStatusLevel;
  first_seen: string;
  assigned_analyst?: string | null;
}

export interface DashboardOverview {
  total_events: number;
  total_alerts: number;
  total_incidents: number;
  total_investigations: number;
  alerts_by_severity: SeverityCount;
  alerts_by_status: StatusCount;
  incidents_by_status: StatusCount;
  critical_high_alerts: number;
  open_critical_high_alerts: number;
  security_posture_score: number;
  posture_grade: string;
  recent_events: DashboardRecentEvent[];
  recent_alerts: DashboardRecentAlert[];
  recent_incidents: DashboardRecentIncident[];
  events_last_24h: number;
  alerts_last_24h: number;
  incidents_last_24h: number;
  generated_at: string;
}

// --- Audit Logs ---
export interface AuditLogEntry {
  id: number;
  incident_id: string;
  action: string;
  previous_state?: Record<string, any> | null;
  new_state?: Record<string, any> | null;
  actor?: string | null;
  reason?: string | null;
  created_at: string;
}

export interface AuditLogListResponse {
  items: AuditLogEntry[];
  total: number;
  limit: number;
  offset: number;
}

// --- AWS Integration Status ---
export interface AWSIntegrationStatus {
  status: string;
  region: string;
  sqs_configured: boolean;
  s3_bucket_configured: boolean;
  queue_url_masked?: string | null;
  custom_endpoint_active: boolean;
}

// --- Detection Rules ---
export interface DetectionRule {
  rule_id: string;
  rule_name: string;
  description: string;
  generates_alerts: boolean;
  evaluation_mode: string;
}

export interface DetectionRuleListResponse {
  rules: DetectionRule[];
  total: number;
}

// --- AWS Integration Operations ---
export interface AWSPollResult {
  messages_received: number;
  messages_deleted: number;
  events_ingested: number;
  duplicates_skipped: number;
  records_failed: number;
  errors: string[];
}

export interface AWSRawIngestResult {
  events_ingested: number;
  duplicates_skipped: number;
  records_failed: number;
}
