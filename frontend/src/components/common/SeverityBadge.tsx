import React from 'react';
import { AlertCircle, AlertOctagon, AlertTriangle, Info, ShieldAlert } from 'lucide-react';
import type { SeverityLevel } from '../../types/api';

interface Props {
  severity: SeverityLevel | string;
  showIcon?: boolean;
}

export const SeverityBadge: React.FC<Props> = ({ severity, showIcon = true }) => {
  const norm = (severity || 'INFORMATIONAL').toUpperCase() as SeverityLevel;

  const renderIcon = () => {
    switch (norm) {
      case 'CRITICAL':
        return <AlertOctagon size={12} />;
      case 'HIGH':
        return <AlertTriangle size={12} />;
      case 'MEDIUM':
        return <AlertCircle size={12} />;
      case 'LOW':
        return <ShieldAlert size={12} />;
      case 'INFORMATIONAL':
      default:
        return <Info size={12} />;
    }
  };

  return (
    <span className={`badge-severity ${norm}`} data-testid={`severity-badge-${norm.toLowerCase()}`}>
      {showIcon && renderIcon()}
      <span>{norm}</span>
    </span>
  );
};
