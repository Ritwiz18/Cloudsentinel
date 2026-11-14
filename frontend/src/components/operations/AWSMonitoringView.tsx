import React, { useState, useEffect, useCallback } from 'react';
import { apiClient, ApiError } from '../../api/client';
import type { AWSIntegrationStatus, AWSPollResult, AWSRawIngestResult } from '../../types/api';
import { LoadingState } from '../common/StateView';
import {
  CheckCircle,
  Cloud,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
  UploadCloud,
} from 'lucide-react';

/**
 * AWS Monitoring View — CloudTrail ingestion operations.
 * All actions go through the apiClient against the FastAPI AWS integration endpoints.
 */
export const AWSMonitoringView: React.FC = () => {
  const [awsStatus, setAwsStatus] = useState<AWSIntegrationStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  const [awsPollRunning, setAwsPollRunning] = useState(false);
  const [awsPollResult, setAwsPollResult] = useState<AWSPollResult | null>(null);
  const [awsPollError, setAwsPollError] = useState<string | null>(null);
  const [awsRawJson, setAwsRawJson] = useState('');
  const [awsRawRunning, setAwsRawRunning] = useState(false);
  const [awsRawResult, setAwsRawResult] = useState<AWSRawIngestResult | null>(null);
  const [awsRawError, setAwsRawError] = useState<string | null>(null);

  const loadStatus = useCallback(() => {
    setStatusLoading(true);
    apiClient
      .getAWSStatus()
      .then((s) => {
        setAwsStatus(s);
        setStatusLoading(false);
      })
      .catch(() => {
        // Status is informational; ingestion controls remain usable.
        setStatusLoading(false);
      });
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // Handler: Poll SQS for live CloudTrail events
  const handleAwsPoll = async () => {
    setAwsPollRunning(true);
    setAwsPollError(null);
    setAwsPollResult(null);
    try {
      const data = await apiClient.pollAWS({ max_messages: 10, wait_time_seconds: 5 });
      setAwsPollResult(data);
    } catch (err: any) {
      setAwsPollError(err instanceof ApiError ? err.message : 'AWS SQS poll failed.');
    } finally {
      setAwsPollRunning(false);
    }
  };

  // Handler: Ingest raw CloudTrail JSON records
  const handleAwsIngestRaw = async () => {
    setAwsRawRunning(true);
    setAwsRawError(null);
    setAwsRawResult(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(awsRawJson.trim());
    } catch {
      setAwsRawError('Invalid JSON — paste a CloudTrail Records object or a raw event array.');
      setAwsRawRunning(false);
      return;
    }
    try {
      const data = await apiClient.ingestRawAWS(parsed as Record<string, any> | Array<Record<string, any>>);
      setAwsRawResult(data);
    } catch (err: any) {
      setAwsRawError(err instanceof ApiError ? err.message : 'Raw ingest failed.');
    } finally {
      setAwsRawRunning(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} data-testid="aws-monitoring-page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Cloud size={18} /> AWS Security Monitoring
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>
            CloudTrail ingestion, SQS polling, and raw record injection
          </p>
        </div>
        <button className="btn btn-secondary" onClick={loadStatus} disabled={statusLoading}>
          <RefreshCw size={14} className={statusLoading ? 'spin' : ''} /> Refresh Status
        </button>
      </div>

      {/* Integration status — real data from GET /api/v1/integrations/aws/status */}
      {statusLoading ? (
        <LoadingState message="Checking AWS integration status..." />
      ) : awsStatus ? (
        <div className="panel-card" data-testid="aws-status-card" style={{ marginBottom: 0 }}>
          <div className="panel-header">
            <div className="panel-title"><Cloud size={16} /> CloudTrail Integration Status</div>
            <span style={{
              padding: '0.2rem 0.65rem', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700,
              background: awsStatus.status === 'active' ? 'rgba(16,185,129,0.12)' : 'rgba(100,116,139,0.12)',
              color: awsStatus.status === 'active' ? '#10b981' : '#94a3b8',
              border: `1px solid ${awsStatus.status === 'active' ? 'rgba(16,185,129,0.4)' : 'rgba(100,116,139,0.4)'}`,
            }}>
              {awsStatus.status === 'active' ? 'ACTIVE' : 'UNCONFIGURED'}
            </span>
          </div>
          <div className="detail-grid" style={{ fontSize: '0.8rem' }}>
            <span className="detail-label">Region</span>
            <span className="detail-val font-mono">{awsStatus.region || '—'}</span>
            <span className="detail-label">SQS Queue</span>
            <span className="detail-val font-mono">{awsStatus.sqs_configured ? 'Configured' : 'Not configured'}</span>
            <span className="detail-label">S3 Bucket</span>
            <span className="detail-val font-mono">{awsStatus.s3_bucket_configured ? 'Configured' : 'Not configured'}</span>
            <span className="detail-label">Custom Endpoint</span>
            <span className="detail-val font-mono">{awsStatus.custom_endpoint_active ? 'Active' : 'Inactive'}</span>
          </div>
          {!awsStatus.sqs_configured && (
            <div style={{ marginTop: '0.75rem', padding: '0.65rem 0.75rem', borderRadius: 6, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', fontSize: '0.78rem', color: '#fbbf24' }}>
              Set <code style={{ background: 'rgba(255,255,255,0.08)', padding: '0.1rem 0.3rem', borderRadius: 3 }}>AWS_CLOUDTRAIL_SQS_QUEUE_URL</code> in your <code>.env</code> to enable live SQS ingestion.
            </div>
          )}
        </div>
      ) : (
        <div className="panel-card" style={{ marginBottom: 0, color: '#64748b', fontSize: '0.85rem' }}>
          Could not retrieve AWS integration status. Ingestion controls below remain usable.
        </div>
      )}

      {/* Ingestion operations */}
      <div className="panel-card" data-testid="aws-ingest-panel" style={{ marginBottom: 0 }}>
        <div className="panel-header">
          <div className="panel-title"><Cloud size={16} /> AWS CloudTrail Ingestion</div>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>POST /api/v1/integrations/aws/*</span>
        </div>
        <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '1.25rem' }}>
          Pull live CloudTrail events via SQS or paste raw event JSON for immediate ingestion and detection.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem' }}>
          {/* SQS Poll sub-card */}
          <div style={{ padding: '1rem', borderRadius: '8px', backgroundColor: 'rgba(129, 140, 248, 0.05)', border: '1px solid rgba(129, 140, 248, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <RotateCcw size={14} style={{ color: '#818cf8' }} />
              <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#c7d2fe' }}>Live SQS Poll</span>
            </div>
            <p style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '1rem', lineHeight: '1.45' }}>
              Reads up to 10 messages from your configured CloudTrail SQS queue, fetches the referenced S3 logs,
              normalises events and runs detection.
              Requires <code style={{ fontSize: '0.75rem' }}>AWS_*</code> env vars to be set.
            </p>

            {awsPollError && (
              <div style={{ marginBottom: '0.75rem', padding: '0.65rem 0.75rem', borderRadius: '6px', backgroundColor: 'rgba(248, 113, 113, 0.1)', border: '1px solid rgba(248, 113, 113, 0.3)', fontSize: '0.8rem', color: '#fca5a5' }} data-testid="aws-poll-error">
                {awsPollError}
              </div>
            )}

            {awsPollResult && (
              <div style={{ marginBottom: '0.75rem', padding: '0.75rem', borderRadius: '6px', backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)' }} data-testid="aws-poll-result">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#34d399', fontWeight: 700, fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                  <CheckCircle size={13} /> SQS Poll Complete
                </div>
                <div className="detail-grid" style={{ fontSize: '0.78rem' }}>
                  <span className="detail-label">Messages received</span>
                  <span className="detail-val font-mono">{awsPollResult.messages_received}</span>
                  <span className="detail-label">Events ingested</span>
                  <span className="detail-val font-mono" style={{ color: '#818cf8', fontWeight: 600 }}>{awsPollResult.events_ingested}</span>
                  <span className="detail-label">Duplicates skipped</span>
                  <span className="detail-val font-mono">{awsPollResult.duplicates_skipped}</span>
                  <span className="detail-label">Records failed</span>
                  <span className="detail-val font-mono" style={{ color: awsPollResult.records_failed > 0 ? '#fca5a5' : undefined }}>{awsPollResult.records_failed}</span>
                </div>
                {awsPollResult.errors.length > 0 && (
                  <ul style={{ paddingLeft: '1rem', marginTop: '0.5rem', fontSize: '0.75rem', color: '#f87171' }}>
                    {awsPollResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                )}
              </div>
            )}

            <button
              className="btn btn-primary"
              onClick={handleAwsPoll}
              disabled={awsPollRunning}
              style={{ width: '100%', justifyContent: 'center' }}
              data-testid="aws-poll-btn"
            >
              {awsPollRunning ? (
                <><Loader2 size={13} className="spin" /> Polling SQS…</>
              ) : (
                <><Play size={13} /> Poll SQS Queue</>
              )}
            </button>
          </div>

          {/* Raw CloudTrail JSON ingest sub-card */}
          <div style={{ padding: '1rem', borderRadius: '8px', backgroundColor: 'rgba(129, 140, 248, 0.05)', border: '1px solid rgba(129, 140, 248, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <UploadCloud size={14} style={{ color: '#818cf8' }} />
              <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#c7d2fe' }}>Paste Raw CloudTrail JSON</span>
            </div>
            <p style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.75rem', lineHeight: '1.45' }}>
              Paste a CloudTrail <code style={{ fontSize: '0.75rem' }}>{"{ \"Records\": [...] }"}</code> payload or a
              raw event array. Events are normalised, deduplicated, and fed into the detection engine immediately.
            </p>

            <textarea
              value={awsRawJson}
              onChange={e => setAwsRawJson(e.target.value)}
              placeholder={'{ "Records": [ { "eventVersion": "1.08", ... } ] }'}
              rows={6}
              style={{
                width: '100%',
                resize: 'vertical',
                fontFamily: 'monospace',
                fontSize: '0.73rem',
                background: 'rgba(0,0,0,0.35)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                color: '#cbd5e1',
                padding: '0.6rem',
                marginBottom: '0.75rem',
                boxSizing: 'border-box',
              }}
              data-testid="aws-raw-json-input"
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
            />

            {awsRawError && (
              <div style={{ marginBottom: '0.75rem', padding: '0.65rem 0.75rem', borderRadius: '6px', backgroundColor: 'rgba(248, 113, 113, 0.1)', border: '1px solid rgba(248, 113, 113, 0.3)', fontSize: '0.8rem', color: '#fca5a5' }} data-testid="aws-raw-error">
                {awsRawError}
              </div>
            )}

            {awsRawResult && (
              <div style={{ marginBottom: '0.75rem', padding: '0.75rem', borderRadius: '6px', backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)' }} data-testid="aws-raw-result">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#34d399', fontWeight: 700, fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                  <CheckCircle size={13} /> Raw Ingest Complete
                </div>
                <div className="detail-grid" style={{ fontSize: '0.78rem' }}>
                  <span className="detail-label">Events ingested</span>
                  <span className="detail-val font-mono" style={{ color: '#818cf8', fontWeight: 600 }}>{awsRawResult.events_ingested}</span>
                  <span className="detail-label">Duplicates skipped</span>
                  <span className="detail-val font-mono">{awsRawResult.duplicates_skipped}</span>
                  <span className="detail-label">Records failed</span>
                  <span className="detail-val font-mono" style={{ color: awsRawResult.records_failed > 0 ? '#fca5a5' : undefined }}>{awsRawResult.records_failed}</span>
                </div>
              </div>
            )}

            <button
              className="btn btn-primary"
              onClick={handleAwsIngestRaw}
              disabled={awsRawRunning || !awsRawJson.trim()}
              style={{ width: '100%', justifyContent: 'center' }}
              data-testid="aws-raw-ingest-btn"
            >
              {awsRawRunning ? (
                <><Loader2 size={13} className="spin" /> Ingesting…</>
              ) : (
                <><UploadCloud size={13} /> Ingest Records</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
