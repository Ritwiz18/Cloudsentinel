import React, { useState, useEffect, useCallback } from 'react';
import { apiClient, ApiError } from '../../api/client';
import type { InvestigationResponse } from '../../types/api';
import {
  Sparkles,
  ShieldCheck,
  HelpCircle,
  AlertTriangle,
  RotateCw,
  Cpu,
  Layers,
  CheckCircle2,
  ListOrdered,
  Info,
} from 'lucide-react';

interface Props {
  incidentId: string;
}

export const IncidentInvestigationView: React.FC<Props> = ({ incidentId }) => {
  const [investigation, setInvestigation] = useState<InvestigationResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const loadInvestigation = useCallback(
    async (forceRefresh: boolean = false) => {
      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const result = await apiClient.investigateIncident(incidentId, {
          force_refresh: forceRefresh,
        });
        setInvestigation(result);
      } catch (err: any) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('Failed to generate or retrieve investigation.');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [incidentId]
  );

  useEffect(() => {
    loadInvestigation(false);
  }, [loadInvestigation]);

  if (loading) {
    return (
      <div
        style={{
          padding: '1.5rem',
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '8px',
          textAlign: 'center',
        }}
        data-testid="investigation-loading"
      >
        <RotateCw
          size={24}
          className="spin"
          style={{
            color: '#38bdf8',
            marginBottom: '0.75rem',
            animation: 'spin 1s linear infinite',
          }}
        />
        <div style={{ fontSize: '0.9rem', color: '#e2e8f0', fontWeight: 600 }}>
          Synthesizing Security Telemetry & Evidence...
        </div>
        <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.35rem' }}>
          Correlating cloud events, detection alerts, and threat hypotheses
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: '1.25rem',
          backgroundColor: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '8px',
        }}
        data-testid="investigation-error"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f87171', fontWeight: 600 }}>
          <AlertTriangle size={18} />
          <span>Investigation Error</span>
        </div>
        <p style={{ fontSize: '0.82rem', color: '#fca5a5', margin: '0.5rem 0 1rem 0' }}>
          {error}
        </p>
        <button
          className="btn btn-secondary"
          onClick={() => loadInvestigation(true)}
          style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
          data-testid="investigation-retry-btn"
        >
          <RotateCw size={13} style={{ marginRight: 4 }} /> Retry Investigation
        </button>
      </div>
    );
  }

  if (!investigation) {
    return (
      <div
        style={{
          padding: '1.5rem',
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
          border: '1px dashed var(--border-subtle)',
          borderRadius: '8px',
          textAlign: 'center',
        }}
        data-testid="investigation-empty"
      >
        <Sparkles size={24} style={{ color: '#818cf8', marginBottom: '0.5rem' }} />
        <div style={{ fontSize: '0.88rem', color: '#cbd5e1', fontWeight: 600 }}>
          No Investigation Generated
        </div>
        <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0.35rem 0 1rem 0' }}>
          Run an automated investigation to synthesize evidence and generate containment guidance.
        </p>
        <button
          className="btn btn-primary"
          onClick={() => loadInvestigation(true)}
          data-testid="run-investigation-btn"
        >
          <Sparkles size={14} style={{ marginRight: 4 }} /> Run Investigation
        </button>
      </div>
    );
  }

  const confidenceColors: Record<string, { bg: string; text: string; border: string }> = {
    HIGH: { bg: 'rgba(16, 185, 129, 0.12)', text: '#34d399', border: 'rgba(16, 185, 129, 0.3)' },
    MEDIUM: { bg: 'rgba(245, 158, 11, 0.12)', text: '#fbbf24', border: 'rgba(245, 158, 11, 0.3)' },
    LOW: { bg: 'rgba(239, 68, 68, 0.12)', text: '#f87171', border: 'rgba(239, 68, 68, 0.3)' },
  };

  const confBadge = confidenceColors[investigation.confidence_level] || confidenceColors.MEDIUM;

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
      data-testid="investigation-results"
    >
      {/* Header & Metadata Controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '0.2rem 0.55rem',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: 700,
              backgroundColor: confBadge.bg,
              color: confBadge.text,
              border: `1px solid ${confBadge.border}`,
            }}
          >
            <ShieldCheck size={12} /> {investigation.confidence_level} CONFIDENCE
          </span>

          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '0.2rem 0.55rem',
              borderRadius: '4px',
              fontSize: '0.72rem',
              backgroundColor: 'rgba(99, 102, 241, 0.1)',
              color: '#a5b4fc',
              border: '1px solid rgba(99, 102, 241, 0.25)',
            }}
          >
            <Cpu size={12} /> {investigation.provider} ({investigation.model})
          </span>

          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
            Generated {new Date(investigation.created_at).toLocaleTimeString()}
          </span>
        </div>

        <button
          className="btn btn-secondary"
          onClick={() => loadInvestigation(true)}
          disabled={refreshing}
          style={{ fontSize: '0.78rem', padding: '0.3rem 0.65rem' }}
          data-testid="refresh-investigation-btn"
        >
          <RotateCw
            size={12}
            style={{
              marginRight: 4,
              animation: refreshing ? 'spin 1s linear infinite' : 'none',
            }}
          />
          {refreshing ? 'Refreshing...' : 'Re-run Investigation'}
        </button>
      </div>

      {/* Synthesis Executive Summary */}
      <div
        style={{
          padding: '0.85rem 1rem',
          backgroundColor: 'rgba(30, 41, 59, 0.4)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '6px',
        }}
      >
        <div
          style={{
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            color: '#94a3b8',
            fontWeight: 700,
            marginBottom: '0.35rem',
            letterSpacing: '0.04em',
          }}
        >
          Executive Summary
        </div>
        <p style={{ fontSize: '0.86rem', color: '#f1f5f9', lineHeight: '1.5', margin: 0 }}>
          {investigation.summary}
        </p>
      </div>

      {/* Two Pillars: Verified Observed Evidence vs Explicit Hypotheses */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '0.85rem',
        }}
      >
        {/* Card 1: Verified Observed Evidence */}
        <div
          style={{
            padding: '0.85rem',
            backgroundColor: 'rgba(16, 185, 129, 0.04)',
            border: '1px solid rgba(16, 185, 129, 0.22)',
            borderRadius: '6px',
          }}
          data-testid="observed-evidence-card"
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.78rem',
              textTransform: 'uppercase',
              color: '#34d399',
              fontWeight: 700,
              marginBottom: '0.5rem',
              letterSpacing: '0.04em',
            }}
          >
            <ShieldCheck size={14} /> Observed Telemetry Evidence (Facts)
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: '1.15rem',
              fontSize: '0.8rem',
              color: '#cbd5e1',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.45rem',
            }}
          >
            {investigation.observed_evidence.map((obs, idx) => (
              <li key={idx} style={{ lineHeight: '1.4' }}>
                {obs}
              </li>
            ))}
          </ul>
        </div>

        {/* Card 2: AI-Generated Hypotheses (Clearly Labeled as Speculation) */}
        <div
          style={{
            padding: '0.85rem',
            backgroundColor: 'rgba(168, 85, 247, 0.04)',
            border: '1px solid rgba(168, 85, 247, 0.25)',
            borderRadius: '6px',
          }}
          data-testid="hypotheses-card"
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.78rem',
              textTransform: 'uppercase',
              color: '#c084fc',
              fontWeight: 700,
              marginBottom: '0.25rem',
              letterSpacing: '0.04em',
            }}
          >
            <HelpCircle size={14} /> AI-Generated Hypotheses (Speculative)
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '0.5rem', fontStyle: 'italic' }}>
            Exploratory attack vectors. Not confirmed facts.
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: '1.15rem',
              fontSize: '0.8rem',
              color: '#e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.45rem',
            }}
          >
            {investigation.hypotheses.map((hyp, idx) => (
              <li key={idx} style={{ lineHeight: '1.4' }}>
                {hyp}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Detection Explanation & Potential Impact */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '0.85rem',
        }}
      >
        <div
          style={{
            padding: '0.85rem',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '6px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              color: '#94a3b8',
              fontWeight: 700,
              marginBottom: '0.4rem',
            }}
          >
            <Layers size={13} /> Detection Explanation
          </div>
          <p style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: '1.45', margin: 0 }}>
            {investigation.detection_explanation}
          </p>
        </div>

        <div
          style={{
            padding: '0.85rem',
            backgroundColor: 'rgba(245, 158, 11, 0.04)',
            border: '1px solid rgba(245, 158, 11, 0.2)',
            borderRadius: '6px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              color: '#fbbf24',
              fontWeight: 700,
              marginBottom: '0.4rem',
            }}
          >
            <AlertTriangle size={13} /> Potential Impact & Blast Radius
          </div>
          <p style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: '1.45', margin: 0 }}>
            {investigation.potential_impact}
          </p>
        </div>
      </div>

      {/* Recommended Defensive Next Steps */}
      <div
        style={{
          padding: '0.85rem 1rem',
          backgroundColor: 'rgba(30, 41, 59, 0.3)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '6px',
        }}
        data-testid="recommended-steps-card"
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.78rem',
            textTransform: 'uppercase',
            color: '#38bdf8',
            fontWeight: 700,
            marginBottom: '0.55rem',
            letterSpacing: '0.04em',
          }}
        >
          <ListOrdered size={14} /> Recommended Investigation & Containment Steps
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          {investigation.recommended_steps.map((step, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                gap: '8px',
                fontSize: '0.82rem',
                color: '#e2e8f0',
                lineHeight: '1.4',
              }}
            >
              <CheckCircle2
                size={14}
                style={{ color: '#38bdf8', flexShrink: 0, marginTop: '2px' }}
              />
              <span>{step}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Traceable Evidence References */}
      {investigation.evidence_references && (
        <div
          style={{
            padding: '0.75rem',
            backgroundColor: '#070a10',
            border: '1px solid var(--border-subtle)',
            borderRadius: '6px',
            fontSize: '0.75rem',
          }}
        >
          <div style={{ fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
            Evidence Traceability Reference
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', color: '#64748b' }}>
            {investigation.evidence_references.alert_ids?.length ? (
              <span>Alerts: {investigation.evidence_references.alert_ids.length}</span>
            ) : null}
            {investigation.evidence_references.event_ids?.length ? (
              <span>Events: {investigation.evidence_references.event_ids.length}</span>
            ) : null}
            {investigation.evidence_references.affected_resources?.length ? (
              <span>Resources: {investigation.evidence_references.affected_resources.join(', ')}</span>
            ) : null}
            {investigation.evidence_references.actors?.length ? (
              <span>Principals: {investigation.evidence_references.actors.join(', ')}</span>
            ) : null}
          </div>
        </div>
      )}

      {/* Limitations & Defensive Disclaimer */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          padding: '0.65rem 0.85rem',
          backgroundColor: 'rgba(100, 116, 139, 0.08)',
          border: '1px solid rgba(100, 116, 139, 0.2)',
          borderRadius: '6px',
          fontSize: '0.75rem',
          color: '#94a3b8',
        }}
      >
        <Info size={14} style={{ flexShrink: 0, marginTop: '1px', color: '#64748b' }} />
        <div>
          <span style={{ fontWeight: 600, color: '#cbd5e1' }}>Limitations & Safe Operations: </span>
          {investigation.confidence_limitations}
          <div style={{ marginTop: '0.2rem', color: '#64748b' }}>
            CloudSentinel AI does not autonomously execute remediations or close incidents. All operational actions require human verification.
          </div>
        </div>
      </div>
    </div>
  );
};
