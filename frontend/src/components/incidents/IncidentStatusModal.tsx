import React, { useState } from 'react';
import { apiClient, ApiError } from '../../api/client';
import type { IncidentDetail, IncidentStatusLevel, SecurityIncident } from '../../types/api';
import { Modal } from '../common/Modal';
import { AlertCircle } from 'lucide-react';

interface Props {
  incident: SecurityIncident | IncidentDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updated: IncidentDetail) => void;
}

interface FormProps {
  incident: SecurityIncident | IncidentDetail;
  onClose: () => void;
  onSuccess: (updated: IncidentDetail) => void;
}

const IncidentStatusForm: React.FC<FormProps> = ({
  incident,
  onClose,
  onSuccess,
}) => {
  const [status, setStatus] = useState<IncidentStatusLevel>(incident.status || 'OPEN');
  const [analyst, setAnalyst] = useState<string>(incident.assigned_analyst || '');
  const [resolutionReason, setResolutionReason] = useState<string>(incident.resolution_reason || '');
  const [changeReason, setChangeReason] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isResolving = status === 'RESOLVED' || status === 'FALSE_POSITIVE';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side enforcement of resolution policy
    if (isResolving && !resolutionReason.trim()) {
      setError(`A resolution reason is mandatory when transitioning incident to ${status}.`);
      return;
    }

    setSubmitting(true);
    try {
      const updated = await apiClient.updateIncident(incident.incident_id, {
        status,
        assigned_analyst: analyst.trim() || undefined,
        resolution_reason: resolutionReason.trim() || undefined,
        change_reason: changeReason.trim() || undefined,
      });
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to update incident. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {error && (
        <div
          style={{
            padding: '0.75rem',
            borderRadius: '6px',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.5rem',
          }}
          data-testid="status-modal-error"
        >
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{error}</span>
        </div>
      )}

      <div>
        <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 600 }}>
          Incident Lifecycle Status *
        </label>
        <select
          className="select-field"
          style={{ width: '100%' }}
          value={status}
          onChange={(e) => setStatus(e.target.value as IncidentStatusLevel)}
          aria-label="Lifecycle status"
          data-testid="status-select"
        >
          <option value="OPEN">OPEN — Active & awaiting triage</option>
          <option value="INVESTIGATING">INVESTIGATING — Under active investigation</option>
          <option value="RESOLVED">RESOLVED — Remediated & closed</option>
          <option value="FALSE_POSITIVE">FALSE_POSITIVE — Dismissed as non-malicious</option>
        </select>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 600 }}>
          Assigned SecOps Analyst
        </label>
        <input
          type="text"
          className="input-field"
          style={{ width: '100%' }}
          placeholder="e.g. secops-analyst-1 or analyst@company.com"
          value={analyst}
          onChange={(e) => setAnalyst(e.target.value)}
          data-testid="analyst-input"
        />
      </div>

      {isResolving && (
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', color: '#fb923c', marginBottom: '0.35rem', fontWeight: 600 }}>
            Mandatory Resolution Reason *
          </label>
          <textarea
            className="input-field"
            rows={3}
            style={{ width: '100%', resize: 'vertical' }}
            placeholder="Describe remediation steps taken, root cause, or evidence supporting false-positive dismissal..."
            value={resolutionReason}
            onChange={(e) => setResolutionReason(e.target.value)}
            data-testid="resolution-reason-input"
          />
          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
            Required by CloudSentinel governance policy before closing this incident.
          </span>
        </div>
      )}

      <div>
        <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 600 }}>
          Audit Change Note (Optional)
        </label>
        <input
          type="text"
          className="input-field"
          style={{ width: '100%' }}
          placeholder="Justification note recorded in immutable audit log"
          value={changeReason}
          onChange={(e) => setChangeReason(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={submitting}
          data-testid="save-status-btn"
        >
          {submitting ? 'Applying Change...' : 'Update Incident'}
        </button>
      </div>
    </form>
  );
};

export const IncidentStatusModal: React.FC<Props> = ({
  incident,
  isOpen,
  onClose,
  onSuccess,
}) => {
  if (!incident) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Update Incident Lifecycle — ${incident.incident_id}`}
    >
      <IncidentStatusForm
        key={incident.incident_id}
        incident={incident}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    </Modal>
  );
};
