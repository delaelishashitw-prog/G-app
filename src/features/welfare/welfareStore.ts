import type { Dispatch, SetStateAction } from 'react';
import type { PaymentMethod, WelfareClaim, WelfareContribution } from '../../types/database.types';

export function recordWelfareContribution(
  data: Omit<WelfareContribution, 'id' | 'created_at'>,
  setWelfareContributions: Dispatch<SetStateAction<WelfareContribution[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void
): WelfareContribution {
  const newRecord: WelfareContribution = {
    ...data,
    id: `wlf-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    created_at: new Date().toISOString(),
  };

  setWelfareContributions((prev) => [newRecord, ...prev]);
  logAction(
    'RECORD_WELFARE_DUES',
    'Welfare',
    `Recorded GH₵ ${data.amount.toFixed(2)} welfare contribution for ${data.member_name} (${data.month})`,
    newRecord.id
  );
  return newRecord;
}

export function deleteWelfareContribution(
  id: string,
  welfareContributions: WelfareContribution[],
  setWelfareContributions: Dispatch<SetStateAction<WelfareContribution[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void
) {
  const toDelete = welfareContributions.find((welfare) => welfare.id === id);
  setWelfareContributions((prev) => prev.filter((welfare) => welfare.id !== id));
  if (toDelete) {
    logAction(
      'DELETE_WELFARE_DUES',
      'Welfare',
      `Deleted welfare contribution of GH₵ ${toDelete.amount.toFixed(2)} for ${toDelete.member_name}`,
      id
    );
  }
}

export function submitWelfareClaim(
  data: Omit<WelfareClaim, 'id' | 'claim_number' | 'created_at'>,
  welfareClaims: WelfareClaim[],
  setWelfareClaims: Dispatch<SetStateAction<WelfareClaim[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void
): WelfareClaim {
  const claimSeq = String(welfareClaims.length + 1).padStart(3, '0');
  const claimNumber = `BEN-${new Date().getFullYear()}-${claimSeq}`;
  const newClaim: WelfareClaim = {
    ...data,
    id: `claim-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    claim_number: claimNumber,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  setWelfareClaims((prev) => [newClaim, ...prev]);
  logAction(
    'SUBMIT_WELFARE_CLAIM',
    'Welfare',
    `Submitted benevolence claim ${claimNumber} for ${data.member_name} (GH₵ ${data.amount_requested.toFixed(2)} - ${data.title})`,
    newClaim.id
  );
  return newClaim;
}

export function updateWelfareClaim(
  id: string,
  updates: Partial<WelfareClaim>,
  setWelfareClaims: Dispatch<SetStateAction<WelfareClaim[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void
) {
  setWelfareClaims((prev) =>
    prev.map((claim) => {
      if (claim.id !== id) return claim;

      const updated = {
        ...claim,
        ...updates,
        updated_at: new Date().toISOString(),
      };
      logAction(
        'UPDATE_WELFARE_CLAIM',
        'Welfare',
        `Updated claim ${claim.claim_number} status to ${updates.status || claim.status}`,
        id
      );
      return updated;
    })
  );
}

export function deleteWelfareClaim(
  id: string,
  welfareClaims: WelfareClaim[],
  setWelfareClaims: Dispatch<SetStateAction<WelfareClaim[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void
) {
  const toDelete = welfareClaims.find((claim) => claim.id === id);
  setWelfareClaims((prev) => prev.filter((claim) => claim.id !== id));
  if (toDelete) {
    logAction(
      'DELETE_WELFARE_CLAIM',
      'Welfare',
      `Deleted benevolence claim ${toDelete.claim_number} (${toDelete.member_name})`,
      id
    );
  }
}

export function disburseWelfareClaim(
  id: string,
  details: {
    disbursement_method: PaymentMethod;
    disbursement_channel?: string;
    disbursement_voucher_no: string;
    amount_approved: number;
    pastoral_notes?: string;
  },
  setWelfareClaims: Dispatch<SetStateAction<WelfareClaim[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void
) {
  const now = new Date().toISOString().split('T')[0];
  setWelfareClaims((prev) =>
    prev.map((claim) => {
      if (claim.id !== id) return claim;

      const updated: WelfareClaim = {
        ...claim,
        status: 'disbursed',
        amount_approved: details.amount_approved,
        disbursement_date: now,
        disbursement_method: details.disbursement_method,
        disbursement_channel: details.disbursement_channel,
        disbursement_voucher_no: details.disbursement_voucher_no,
        pastoral_notes: details.pastoral_notes || claim.pastoral_notes,
        updated_at: new Date().toISOString(),
      };
      logAction(
        'DISBURSE_WELFARE_CLAIM',
        'Welfare',
        `Disbursed benevolence payment of GH₵ ${details.amount_approved.toFixed(2)} to ${claim.member_name} (Voucher ${details.disbursement_voucher_no})`,
        id
      );
      return updated;
    })
  );
}
