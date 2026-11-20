import React from 'react';

const getRiskLevel = (score, riskLevel) => {
  const level = riskLevel || (score >= 0.6 ? 'High' : score >= 0.3 ? 'Medium' : 'Low');
  if (level === 'High') return { label: 'High', bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', dot: 'bg-red-500' };
  if (level === 'Medium') return { label: 'Medium', bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300', dot: 'bg-amber-400' };
  return { label: 'Low', bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300', dot: 'bg-green-500' };
};

export const RiskScoreBadge = ({ score = 0, riskLevel, showScore = true, size = 'sm' }) => {
  const level = getRiskLevel(score, riskLevel);
  const pad = size === 'md' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${pad} ${level.bg} ${level.text} ${level.border}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${level.dot}`} />
      {level.label}
      {showScore && (
        <span className="opacity-70">({(score * 100).toFixed(0)}%)</span>
      )}
    </span>
  );
};
