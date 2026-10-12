import React, { useState } from 'react';
import { apiClient, ApiError } from '../../api/client';
import type { CorrelationRunResponse, DetectionRunResponse } from '../../types/api';
import { Modal } from '../common/Modal';
import {
  AlertTriangle,
  CheckCircle,
  Cpu,
  GitMerge,
  Info,
  Loader2,
  Play,
  RotateCcw,
} from 'lucide-react';

export const OperationsView: React.FC = () => {
  // Detection controls state
  const [detLimit, setDetLimit] = useState(100);
  const [detLookback, setDetLookback] = useState(60);
  const [detRealOnly, setDetRealOnly] = useState(false);
  const [detRunning, setDetRunning] = useState(false);
  const [detResult, setDetResult] = useState<DetectionRunResponse | null>(null);
  const [detError, setDetError] = useState<string | null>(null);
  const [confirmDetOpen, setConfirmDetOpen] = useState(false);

  // Correlation controls state
  const [corrLookback, setCorrLookback] = useState(120);
  const [corrWindow, setCorrWindow] = useState(60);
  const [corrStatus, setCorrStatus] = useState('OPEN');
  const [corrRunning, setCorrRunning] = useState(false);
  const [corrResult, setCorrResult] = useState<CorrelationRunResponse | null>(null);
  const [corrError, setCorrError] = useState<string | null>(null);
  const [confirmCorrOpen, setConfirmCorrOpen] = useState(false);

  // Handler for Detection Run
  const handleRunDetection = async () => {
    setConfirmDetOpen(false);
    setDetRunning(true);
    setDetError(null);
    setDetResult(null);

    try {
      const resp = await apiClient.runDetections({
        limit: detLimit,
        lookback_minutes: detLookback,
        real_only: detRealOnly,
      });
      setDetResult(resp);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setDetError(err.message);
      } else {
        setDetError('Detection run failed. Please verify API connectivity.');
      }
    } finally {
      setDetRunning(false);
    }
  };

  // Handler for Correlation Run
  const handleRunCorrelation = async () => {
    setConfirmCorrOpen(false);
    setCorrRunning(true);
    setCorrError(null);
    setCorrResult(null);

    try {
      const resp = await apiClient.runCorrelation({
        lookback_minutes: corrLookback,
        window_minutes: corrWindow,
        status_filter: corrStatus,
      });
      setCorrResult(resp);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setCorrError(err.message);
      } else {
        setCorrError('Correlation run failed. Please verify API connectivity.');
      }
    } finally {
      setCorrRunning(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} data-testid="operations-page-container">
      {/* Dev / Analyst Header Banner */}
      <div
        style={{
          padding: '1rem 1.25rem',
          borderRadius: '8px',
          backgroundColor: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          color: '#cbd5e1',
          fontSize: '0.85rem',
        }}
      >
        <Info size={20} style={{ color: '#38bdf8', flexShrink: 0 }} />
        <div>
          <strong style={{ color: '#f1f5f9' }}>Analyst & Development Operations:</strong> Trigger
          rule-based threat detection against stored events and execute alert correlation to generate
          or update security incidents. All actions operate on local PostgreSQL data.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
        {/* Detection Engine Operations Card */}
        <div className="panel-card" style={{ marginBottom: 0 }} data-testid="detection-ops-card">
          <div className="panel-header">
            <h3 className="panel-title">
              <Cpu size={18} style={{ color: '#06b6d4' }} /> Threat Detection Evaluation
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>POST /api/v1/detections/run</span>
          </div>

          <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1.25rem' }}>
            Inspects ingested security events against configured detection rules (AUTH-001, IAM-001,
            IAM-002, S3-001, S3-002) and persists deduplicated alerts.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>
                Event Batch Limit (1–500)
              </label>
              <input
                type="number"
                className="input-field"
                style={{ width: '100%' }}
                min={1}
                max={500}
                value={detLimit}
                onChange={(e) => setDetLimit(parseInt(e.target.value) || 100)}
                disabled={detRunning}
                data-testid="detection-limit-input"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>
                Lookback Window (Minutes: 1–1440)
              </label>
              <input
                type="number"
                className="input-field"
                style={{ width: '100%' }}
                min={1}
                max={1440}
                value={detLookback}
                onChange={(e) => setDetLookback(parseInt(e.target.value) || 60)}
                disabled={detRunning}
                data-testid="detection-lookback-input"
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#cbd5e1', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={detRealOnly}
                onChange={(e) => setDetRealOnly(e.target.checked)}
                disabled={detRunning}
              />
              Ignore synthetic simulation events (`real_only`)
            </label>
          </div>

          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => setConfirmDetOpen(true)}
            disabled={detRunning}
            data-testid="trigger-detection-btn"
          >
            {detRunning ? (
              <>
                <Loader2 size={16} className="spin" /> Evaluating Detection Rules...
              </>
            ) : (
              <>
                <Play size={16} /> Execute Threat Detection
              </>
            )}
          </button>

          {/* Detection Run Error */}
          {detError && (
            <div
              style={{
                marginTop: '1rem',
                padding: '0.75rem',
                borderRadius: '6px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: '#f87171',
                fontSize: '0.82rem',
                border: '1px solid rgba(239, 68, 68, 0.3)',
              }}
              data-testid="detection-error-banner"
            >
              {detError}
            </div>
          )}

          {/* Detection Run Result */}
          {detResult && (
            <div
              style={{
                marginTop: '1rem',
                padding: '1rem',
                borderRadius: '6px',
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
              }}
              data-testid="detection-result-card"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#34d399', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                <CheckCircle size={15} /> Detection Run Completed Successfully
              </div>
              <div className="detail-grid" style={{ fontSize: '0.8rem' }}>
                <span className="detail-label">Events Evaluated</span>
                <span className="detail-val font-mono">{detResult.events_evaluated}</span>

                <span className="detail-label">New Alerts Created</span>
                <span className="detail-val font-mono" style={{ color: '#fbbf24', fontWeight: 600 }}>
                  {detResult.alerts_created}
                </span>

                <span className="detail-label">Existing Alerts Updated</span>
                <span className="detail-val font-mono">{detResult.alerts_updated}</span>

                <span className="detail-label">Rules Evaluated</span>
                <span className="detail-val font-mono">{detResult.rules_evaluated}</span>
              </div>
            </div>
          )}
        </div>

        {/* Incident Correlation Operations Card */}
        <div className="panel-card" style={{ marginBottom: 0 }} data-testid="correlation-ops-card">
          <div className="panel-header">
            <h3 className="panel-title">
              <GitMerge size={18} style={{ color: '#8b5cf6' }} /> Alert Correlation Engine
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>POST /api/v1/incidents/correlate</span>
          </div>

          <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1.25rem' }}>
            Aggregates open alerts into correlated incidents based on shared identity pivots (actor,
            IP, resource) and temporal clustering.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>
                Lookback Window (Minutes: 1–1440)
              </label>
              <input
                type="number"
                className="input-field"
                style={{ width: '100%' }}
                min={1}
                max={1440}
                value={corrLookback}
                onChange={(e) => setCorrLookback(parseInt(e.target.value) || 120)}
                disabled={corrRunning}
                data-testid="correlation-lookback-input"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>
                Correlation Span Window (Minutes: 1–240)
              </label>
              <input
                type="number"
                className="input-field"
                style={{ width: '100%' }}
                min={1}
                max={240}
                value={corrWindow}
                onChange={(e) => setCorrWindow(parseInt(e.target.value) || 60)}
                disabled={corrRunning}
                data-testid="correlation-window-input"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>
                Alert Status Filter
              </label>
              <select
                className="select-field"
                style={{ width: '100%' }}
                value={corrStatus}
                onChange={(e) => setCorrStatus(e.target.value)}
                disabled={corrRunning}
                aria-label="Alert status filter"
              >
                <option value="OPEN">OPEN (Default)</option>
                <option value="INVESTIGATING">INVESTIGATING</option>
                <option value="RESOLVED">RESOLVED</option>
              </select>
            </div>
          </div>

          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => setConfirmCorrOpen(true)}
            disabled={corrRunning}
            data-testid="trigger-correlation-btn"
          >
            {corrRunning ? (
              <>
                <Loader2 size={16} className="spin" /> Executing Correlation Pipeline...
              </>
            ) : (
              <>
                <RotateCcw size={16} /> Execute Incident Correlation
              </>
            )}
          </button>

          {/* Correlation Run Error */}
          {corrError && (
            <div
              style={{
                marginTop: '1rem',
                padding: '0.75rem',
                borderRadius: '6px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: '#f87171',
                fontSize: '0.82rem',
                border: '1px solid rgba(239, 68, 68, 0.3)',
              }}
              data-testid="correlation-error-banner"
            >
              {corrError}
            </div>
          )}

          {/* Correlation Run Result */}
          {corrResult && (
            <div
              style={{
                marginTop: '1rem',
                padding: '1rem',
                borderRadius: '6px',
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
              }}
              data-testid="correlation-result-card"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#34d399', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                <CheckCircle size={15} /> Correlation Pipeline Completed
              </div>
              <div className="detail-grid" style={{ fontSize: '0.8rem' }}>
                <span className="detail-label">Alerts Evaluated</span>
                <span className="detail-val font-mono">{corrResult.alerts_evaluated}</span>

                <span className="detail-label">New Incidents Created</span>
                <span className="detail-val font-mono" style={{ color: '#fbbf24', fontWeight: 600 }}>
                  {corrResult.incidents_created}
                </span>

                <span className="detail-label">Incidents Updated</span>
                <span className="detail-val font-mono">{corrResult.incidents_updated}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal for Threat Detection */}
      <Modal
        isOpen={confirmDetOpen}
        onClose={() => setConfirmDetOpen(false)}
        title="Confirm Threat Detection Run"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setConfirmDetOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleRunDetection} data-testid="confirm-detection-action">
              Proceed with Run
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <AlertTriangle size={24} style={{ color: '#fbbf24', flexShrink: 0 }} />
          <div style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.5' }}>
            This operation will evaluate stored security events in PostgreSQL against active detection
            rules. Any matching attack patterns will create or update persistent SecurityAlert
            records.
          </div>
        </div>
      </Modal>

      {/* Confirmation Modal for Incident Correlation */}
      <Modal
        isOpen={confirmCorrOpen}
        onClose={() => setConfirmCorrOpen(false)}
        title="Confirm Incident Correlation Run"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setConfirmCorrOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleRunCorrelation} data-testid="confirm-correlation-action">
              Proceed with Correlation
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <AlertTriangle size={24} style={{ color: '#fbbf24', flexShrink: 0 }} />
          <div style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.5' }}>
            This operation clusters unattached or open security alerts sharing identity pivots
            within the specified {corrWindow}-minute temporal span. New incidents will be created
            and existing open incidents will be updated.
          </div>
        </div>
      </Modal>
    </div>
  );
};
