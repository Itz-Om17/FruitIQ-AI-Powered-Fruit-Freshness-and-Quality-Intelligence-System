import React from 'react';
import { PriorityLevel } from '../types';

interface Props {
  level?: PriorityLevel;
  score?: number;
  showScore?: boolean;
}

export const PriorityBadge: React.FC<Props> = ({ level = 'normal', score, showScore = false }) => {
  const config = {
    urgent: {
      bg: 'bg-red-100 text-red-800 border-red-300',
      label: 'Urgent Action'
    },
    sell_first: {
      bg: 'bg-amber-100 text-amber-800 border-amber-300',
      label: 'Sell / Distribute First'
    },
    monitor: {
      bg: 'bg-blue-100 text-blue-800 border-blue-300',
      label: 'Monitor Closely'
    },
    normal: {
      bg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      label: 'Normal Priority'
    },
    manual_review: {
      bg: 'bg-purple-100 text-purple-800 border-purple-300',
      label: 'Manual Review'
    }
  }[level] || {
    bg: 'bg-slate-100 text-slate-800 border-slate-300',
    label: level
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${config.bg}`}>
      <span>{config.label}</span>
      {showScore && typeof score === 'number' && (
        <span className="opacity-75">· {score}pts</span>
      )}
    </span>
  );
};
