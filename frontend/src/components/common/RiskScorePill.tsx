import React from 'react';

interface Props {
  score: number;
}

export const RiskScorePill: React.FC<Props> = ({ score }) => {
  const getColors = () => {
    if (score >= 85) return { bg: 'rgba(239, 68, 68, 0.2)', text: '#f87171', border: 'rgba(239, 68, 68, 0.5)' };
    if (score >= 60) return { bg: 'rgba(249, 115, 22, 0.2)', text: '#fb923c', border: 'rgba(249, 115, 22, 0.5)' };
    if (score >= 40) return { bg: 'rgba(245, 158, 11, 0.2)', text: '#fbbf24', border: 'rgba(245, 158, 11, 0.5)' };
    if (score >= 20) return { bg: 'rgba(14, 165, 233, 0.2)', text: '#38bdf8', border: 'rgba(14, 165, 233, 0.5)' };
    return { bg: 'rgba(100, 116, 139, 0.2)', text: '#94a3b8', border: 'rgba(100, 116, 139, 0.5)' };
  };

  const style = getColors();

  return (
    <span
      className="risk-pill"
      style={{
        backgroundColor: style.bg,
        color: style.text,
        border: `1px solid ${style.border}`,
      }}
      title={`Risk Score: ${score}/100`}
    >
      {score}/100
    </span>
  );
};
