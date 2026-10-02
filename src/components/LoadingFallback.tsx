import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingFallback: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 space-y-3">
      <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-800 shadow-2xs">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-700" />
      </div>
      <div className="text-center">
        <span className="text-xs font-bold text-slate-700 block">Loading Church Records...</span>
        <span className="text-[11px] text-slate-400">Greater Works City Church</span>
      </div>
    </div>
  );
};
