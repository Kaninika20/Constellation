import React from 'react';

const getRiskLevel = (score) => {
  if (score >= 0.75) return { label: 'Critical', bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', dot: 'bg-red-500' };
  if (score >= 0.5)  return { label: 'High Risk', bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300', dot: 'bg-orange-500' };
  if (score >= 0.2)  return { label: 'Moderate',  bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300', dot: 'bg-amber-400' };
  return               { label: 'Low Risk',  bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300', dot: 'bg-green-500' };
};

export const RiskScoreBadge = ({ score = 0, showScore = true, size = 'sm' }) => {
  const level = getRiskLevel(score);
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
