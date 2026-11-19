import React from 'react';
import { Card } from '../common/Card';

export const StatCard = ({ title, value, change, icon: Icon, color = 'blue' }) => {
  const colorStyles = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100'
  };

  return (
    <Card hover className="p-5 flex items-center justify-between">
      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
        <h4 className="text-2xl font-bold text-slate-900 mt-1">{value}</h4>
        {change && (
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <span className="text-emerald-600 font-semibold">{change}</span> vs last month
          </p>
        )}
      </div>
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${colorStyles[color] || colorStyles.blue}`}>
        <Icon className="w-6 h-6" />
      </div>
    </Card>
  );
};

