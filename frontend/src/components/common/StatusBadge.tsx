import React from 'react';
import type { IncidentStatusLevel, AlertStatusLevel } from '../../types/api';

interface Props {
  status: IncidentStatusLevel | AlertStatusLevel | string;
}

export const StatusBadge: React.FC<Props> = ({ status }) => {
  const norm = (status || 'OPEN').toUpperCase();

  return (
    <span className={`badge-status ${norm}`} data-testid={`status-badge-${norm.toLowerCase()}`}>
      {norm}
    </span>
  );
};
