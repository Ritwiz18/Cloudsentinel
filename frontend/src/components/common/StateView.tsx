import React from 'react';
import { AlertTriangle, Database, Loader2, RefreshCw } from 'lucide-react';

interface LoadingProps {
  message?: string;
}

export const LoadingState: React.FC<LoadingProps> = ({ message = 'Loading security data...' }) => (
  <div className="state-box" data-testid="loading-state">
    <Loader2 size={36} className="state-icon" style={{ animation: 'spin 1s linear infinite' }} />
    <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
    <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{message}</p>
  </div>
);

interface ErrorProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorProps> = ({
  title = 'Failed to load data',
  message,
  onRetry,
}) => (
  <div className="state-box" data-testid="error-state">
    <AlertTriangle size={42} style={{ color: '#f87171' }} />
    <h4 style={{ color: '#f1f5f9', fontSize: '1rem', fontWeight: 600 }}>{title}</h4>
    <p style={{ color: '#94a3b8', fontSize: '0.85rem', maxWidth: '440px' }}>{message}</p>
    {onRetry && (
      <button className="btn btn-secondary" onClick={onRetry} style={{ marginTop: '0.5rem' }}>
        <RefreshCw size={14} /> Retry Request
      </button>
    )}
  </div>
);

interface EmptyProps {
  title?: string;
  message?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyProps> = ({
  title = 'No records found',
  message = 'There are no events, alerts, or incidents matching your current filters.',
  action,
}) => (
  <div className="state-box" data-testid="empty-state">
    <Database size={38} className="state-icon" />
    <h4 style={{ color: '#f1f5f9', fontSize: '0.95rem', fontWeight: 600 }}>{title}</h4>
    <p style={{ color: '#64748b', fontSize: '0.85rem', maxWidth: '400px' }}>{message}</p>
    {action && <div style={{ marginTop: '0.75rem' }}>{action}</div>}
  </div>
);
