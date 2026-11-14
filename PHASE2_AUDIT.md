# CloudSentinel Phase 2 — Product Quality & Functionality Audit

**Date**: 2026-11-14
**Scope**: Every frontend page/component inspected; every button, dropdown, filter, nav item, chart, and action traced frontend → API → database.
**Method**: Static inspection of all 27 frontend components + live queries against the running backend (PostgreSQL at 127.0.0.1:5432) to compare UI claims against real persisted data.

## Live Data Baseline (queried this audit)

| Collection | Totals |
|---|---|
| Events | 37 (Authentication 18, IAMPolicyChange 7, EC2Read 4, StorageAccess 2, StorageConfiguration 2, STSRead 2, StorageRead 2; source: simulator 35, aws.cloudtrail 2; SUCCESS 20 / FAILURE 17) |
| Alerts | 10 (IAM-001 ×5, STORAGE-001 ×4, AUTH-001 ×1; HIGH 6 / CRITICAL 4; all OPEN) |
| Incidents | 4 (OPEN 2, INVESTIGATING 1, RESOLVED 1; HIGH 2 / CRITICAL 2) |
| Audit logs | 9 (STATUS_CHANGED, ASSIGNED, CREATED, …) |

Real detection rules registered in the engine: **AUTH-001, IAM-001, STORAGE-001, BENIGN-001** (benign filter never alerts). Anything else in the UI is fabricated.

---

## P0 — CRITICAL BUGS (wrong behavior / misleading status)

| # | Finding | Evidence | Impact |
|---|---|---|---|
| C1 | `CSPMView.tsx:23` filters `a.rule_id.startsWith('STG')` — real rule is `STORAGE-001`, so the filter **never matches** | Live DB: 4 STORAGE-001 alerts exist; CSP-002 "Storage Misconfiguration" shows PASS | Misleading PASS on a security posture check — the worst class of bug in a SOC product |
| C2 | `App.tsx:136` `setApiOnline(h.database !== 'unavailable')` conflates API reachability with DB health; when DB is down the pill reads **"API: Offline"** and the `"(DB offline)"` branch at App.tsx:115-116 is dead code | Phase 1 report itself specifies "API: Connected (DB offline)" | User cannot distinguish API-down from DB-down; status indicator lies |
| C3 | `backend/app/api/v1/dashboard.py:237` `open_critical=sev_map.get("CRITICAL",0) if astatus_map.get("OPEN",0)>0 else 0` uses **total** CRITICAL count whenever any alert is open, not open-CRITICAL count | 10 alerts, all OPEN, 4 CRITICAL → open_critical=4 even if 3 were resolved | Posture score (`_calculate_posture_score`) computed from wrong input → wrong grade |
| C4 | `IAMRiskView.tsx` `IAM_RULES = ['IAM-001','IAM-002','IAM-003','STG-001','STG-002']` + filter `startsWith(rule.split('-')[0])` → `'STG'` never matches `STORAGE-001`; IAM-002/IAM-003/STG-001/STG-002 don't exist; legend map fabricated | Live DB has zero IAM-002/IAM-003/STG-* alerts | Storage-risk alerts silently dropped from IAM risk view; legend invents rules |
| C5 | `AlertsTable.tsx` rule dropdown offers phantom rules IAM-002, S3-001, S3-002 (backend does exact `==` match) | Selecting them always returns 0 rows | Broken filter; user concludes data is missing |

## P1 — BROKEN FUNCTIONALITY

| # | Finding | Evidence |
|---|---|---|
| B1 | `SettingsView.tsx` is a fully static placeholder: zero API calls; hardcoded "PostgreSQL 16", "postgres (Docker internal)", table list, "React 19 + Vite 8", **wrong rule IDs** "(auth_failures, iam_policy, storage_config)", broken `file:docs/...` hrefs, stale API endpoint list | Read end-to-end; no `apiClient` import |
| B2 | `IntegrationsView.tsx` fabricates: PostgreSQL card hardcoded `status="connected"` + "Connection Healthy" **even when DB is down**; Event Simulator card "4 Scenario Packs Available" + 4 pack names — no simulator/seed endpoint exists in backend; AI card hardcodes provider/model | Read end-to-end; grep confirms no `/simulator` route |
| B3 | `OperationsView.tsx` AWS poll + raw-ingest use raw `fetch` with `import.meta.env.VITE_API_BASE_URL \|\| 'http://localhost:8000'`, bypassing `apiClient`'s localhost↔127.0.0.1 loopback fallback; AWS panel uses `className="card"` — **no `.card` class exists in index.css** (only `.panel-card`) | Phase 1 fixed loopback in apiClient; AWS buttons regress it |
| B4 | `App.tsx` 'aws' tab renders `<OperationsView />` → duplicates the Operations tab wholesale; 'investigate' tab is a static placeholder with no real content; **no global investigations list endpoint exists** (only per-incident) | App.tsx:254-293; investigations.py has only POST per-incident, GET by id, GET history |
| B5 | `ThreatDetectionView.tsx` rule filter is free-text `<input>` sent as `rule_id`; backend does exact equality → any partial text returns nothing | detection/service.py `list_alerts` `rule_id ==` |
| B6 | `EventsTable.tsx` event_type options missing EC2Read, STSRead, StorageRead, StorageConfiguration; source option `aws.guardduty` doesn't exist in data | Live event_type distribution above |
| B7 | `AuditLogsView.tsx` ACTION_COLORS keyed to wrong names: `STATUS_UPDATED` (real: `STATUS_CHANGED`), `ANALYST_ASSIGNED` (real: `ASSIGNED`), `INVESTIGATED` (nonexistent); real actions `CREATED`/`ASSIGNED`/`ALERTS_ATTACHED` not offered | Live audit actions; correlation/service.py emits these |
| B8 | `backend/app/api/v1/audit.py` uses deprecated pydantic `class Config: from_attributes = True` | Deprecation warning on import |

## P2 — UI/UX PROBLEMS

| # | Finding |
|---|---|
| U1 | Every dropdown hardcodes options instead of deriving from real data (Events, Alerts, Threats, Audit) — drift is guaranteed to recur |
| U2 | Dead code: `dashboard/MetricCards.tsx`, `SeverityChart.tsx`, `RecentAlertsList.tsx`, `RecentIncidentsList.tsx` — grep-confirmed never imported; `OverviewView` re-implements them inline |
| U3 | `OperationsView.tsx` description text lists phantom rules "(AUTH-001, IAM-001, IAM-002, S3-001, S3-002)" |
| U4 | `OverviewView.tsx` carries two fetch paths (a `loadData` callback and a duplicate inline `useEffect`) — code smell, double-fetch risk |
| U5 | AWS panel visually inconsistent (unstyled `.card`) next to `.panel-card` siblings |

## P3 — DATA INTEGRITY PROBLEMS

| # | Finding |
|---|---|
| D1 | Hardcoded values presented as live: "Connection Healthy" (DB may be down), "4 Scenario Packs Available" (no such feature), SettingsView engine/table/rule claims |
| D2 | Misleading indicators: health pill "API: Offline" while API is reachable; CSP-002 PASS caused by a filter bug, not by a clean posture |
| D3 | CSP-005 claims "incident(s) unassigned" but only checks `incidents_by_status.OPEN === 0` — never checks assignment |

## P4 — PERFORMANCE PROBLEMS

| # | Finding |
|---|---|
| P1 | CSPMView + IAMRiskView fetch up to 200 alerts and aggregate client-side; fine at 10 alerts, O(n×m) drift as data grows — server-side facets/rule list remove the need |
| P2 | No caching of static metadata (rules list, health) — each view refetches; health polled every 30s in App + per-view |

---

## Fix Plan (systematic, in dependency order)

**Backend**
1. `dashboard.py` — fix `open_critical` to count OPEN **and** CRITICAL alerts (C3)
2. `detection/service.py` `list_alerts` — `ilike` partial rule_id match (exact values still match; regression tests assert exact still works) (enables B5 fix)
3. New `GET /api/v1/detections/rules` — engine rule metadata (rule_id, name, description, severity, enabled) (kills C4/C5/B1/B2/U1 at the source)
4. New `GET /api/v1/investigations` — global list (B4); schema `InvestigationListResponse` already exists
5. Extend `GET /health` with `detection_engine` block (rules, provider, model) — powers honest Settings/Integrations/Investigate views (B1/B2)
6. `audit.py` — `model_config = ConfigDict(from_attributes=True)` (B8)

**Frontend**
7. `client.ts` + `types/api.ts` — add `getDetectionRules`, `listInvestigations`, `pollAWS`, `ingestRawAWS`; types for rules/health extension
8. `App.tsx` — separate API-reachability from DB status in pill (C2); real `InvestigationsView` for 'investigate'; new `AWSMonitoringView` for 'aws' (B4)
9. `OperationsView.tsx` — detection/correlation only; AWS panels moved out; `panel-card`; real rule IDs; AWS calls via apiClient (B3/U3/U5)
10. `AlertsTable.tsx` / `ThreatDetectionView.tsx` / `IAMRiskView.tsx` / `CSPMView.tsx` / `EventsTable.tsx` / `AuditLogsView.tsx` — options derived from real rules + real data; CSP-002 prefix fixed; CSP-005 real assignment check (C1/C4/C5/B5/B6/B7/U1)
11. `SettingsView.tsx` / `IntegrationsView.tsx` — fetch `/health` + `/detections/rules`; honest "Not Configured" for simulator; real provider/model (B1/B2/D1)
12. `OverviewView.tsx` — collapse duplicate fetch (U4); dead dashboard components left untouched (constraint: no deletions)

**Verification** — backend pytest, frontend vitest + build, live curl against 127.0.0.1:8000; document actual results in PHASE2_REPORT.md.

**Constraints honored**: no DB reset, no Docker volume removal, no deletion of existing functionality, no overwriting unrelated Git changes.
