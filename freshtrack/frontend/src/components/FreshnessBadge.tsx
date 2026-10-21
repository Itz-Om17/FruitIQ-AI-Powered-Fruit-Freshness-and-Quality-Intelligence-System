import React from 'react';
import { FreshnessState } from '../types';

interface Props {
  state?: FreshnessState;
  score?: number;
  size?: 'sm' | 'md' | 'lg';
}

export const FreshnessBadge: React.FC<Props> = ({ state = 'UNKNOWN', score, size = 'md' }) => {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs font-medium',
    lg: 'px-3 py-1.5 text-sm font-semibold'
  };

  const config = {
    FRESH: {
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-500/20',
      dot: 'bg-emerald-500',
      label: 'Fresh'
    },
    'SEMI-FRESH': {
      bg: 'bg-amber-50 text-amber-700 border-amber-200 ring-amber-500/20',
      dot: 'bg-amber-500',
      label: 'Semi-Fresh'
    },
    ROTTEN: {
      bg: 'bg-rose-50 text-rose-700 border-rose-200 ring-rose-500/20',
      dot: 'bg-rose-500',
      label: 'Rotten'
    },
    UNKNOWN: {
      bg: 'bg-slate-50 text-slate-700 border-slate-200 ring-slate-500/20',
      dot: 'bg-slate-400',
      label: 'Unknown'
    },
    NOT_INSPECTED: {
      bg: 'bg-purple-50 text-purple-700 border-purple-200 ring-purple-500/20',
      dot: 'bg-purple-400',
      label: 'Not Inspected'
    }
  }[state] || {
    bg: 'bg-slate-50 text-slate-700 border-slate-200 ring-slate-500/20',
    dot: 'bg-slate-400',
    label: state
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border ring-1 ${config.bg} ${sizeClasses[size]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      <span>{config.label}</span>
      {typeof score === 'number' && (
        <span className="opacity-80 font-normal">({score.toFixed(0)}%)</span>
      )}
    </span>
  );
};
