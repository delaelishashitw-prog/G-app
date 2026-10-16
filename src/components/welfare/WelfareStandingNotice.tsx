import React from 'react';
import type { WelfareStanding } from '../../features/welfare/welfareEligibility';

export const WelfareStandingNotice: React.FC<{ standing: WelfareStanding }> = ({ standing }) => (
  <div className={`rounded-xl border p-3 text-xs space-y-1 ${standing.isDefaulter
    ? 'border-rose-200 bg-rose-50 text-rose-900'
    : standing.eligibility === 'full'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
    <p className="font-bold">{standing.label}</p>
    <p>{standing.arrearsCount === null ? 'Arrears cannot be assessed without a joining date or dues history.' :
      `${standing.arrearsCount} unpaid month(s) through ${standing.assessedThrough}. ${standing.paidMonths.length} distinct month(s) paid.`}</p>
    {standing.startMonth && <p>Assessed from {standing.startMonth} ({standing.startBasis}); the current month is not overdue.</p>}
    {standing.isDefaulter && <p>Applications remain open. The Welfare Committee must decide and approve the partial benefit amount.</p>}
    {standing.arrearsMonths.length > 0 && <details>
      <summary className="cursor-pointer font-semibold">View unpaid months</summary>
      <p className="mt-1 break-words">{standing.arrearsMonths.join(', ')}</p>
    </details>}
  </div>
);
