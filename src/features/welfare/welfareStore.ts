import type { Dispatch, SetStateAction } from 'react';
import type {
  PaymentMethod,
  WelfareClaim,
  WelfareContribution,
  WelfareEvent,
  WelfareEventContribution,
  WelfareEventCategory,
  WelfareEventStatus,
  ChurchAccount,
  ChurchFinanceRecord,
} from '../../types/database.types';

export function recordWelfareContribution(
  data: Omit<WelfareContribution, 'id' | 'created_at'>,
  setWelfareContributions: Dispatch<SetStateAction<WelfareContribution[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert?: (table: string, record: any) => Promise<void> | void
): WelfareContribution {
  const newRecord: WelfareContribution = {
    ...data,
    id: `wlf-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    created_at: new Date().toISOString(),
  };

  setWelfareContributions((prev) => [newRecord, ...prev]);
  if (dbSyncUpsert) {
    dbSyncUpsert('welfare_contributions', newRecord);
  }
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
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncDelete?: (table: string, id: string) => Promise<void> | void
) {
  const toDelete = welfareContributions.find((welfare) => welfare.id === id);
  setWelfareContributions((prev) => prev.filter((welfare) => welfare.id !== id));
  if (dbSyncDelete) {
    dbSyncDelete('welfare_contributions', id);
  }
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
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert?: (table: string, record: any) => Promise<void> | void
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
  if (dbSyncUpsert) {
    dbSyncUpsert('welfare_claims', newClaim);
  }
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
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert?: (table: string, record: any) => Promise<void> | void
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
      if (dbSyncUpsert) {
        dbSyncUpsert('welfare_claims', updated);
      }
      return updated;
    })
  );
}

export function deleteWelfareClaim(
  id: string,
  welfareClaims: WelfareClaim[],
  setWelfareClaims: Dispatch<SetStateAction<WelfareClaim[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncDelete?: (table: string, id: string) => Promise<void> | void
) {
  const toDelete = welfareClaims.find((claim) => claim.id === id);
  setWelfareClaims((prev) => prev.filter((claim) => claim.id !== id));
  if (dbSyncDelete) {
    dbSyncDelete('welfare_claims', id);
  }
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
    amount_paid?: number;
    pastoral_notes?: string;
    finance_account_id?: string;
    finance_account_name?: string;
    recorded_by?: string;
  },
  setWelfareClaims: Dispatch<SetStateAction<WelfareClaim[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert?: (table: string, record: any) => Promise<void> | void
) {
  const now = new Date().toISOString().split('T')[0];
  const paymentAmount = details.amount_paid !== undefined ? details.amount_paid : details.amount_approved;

  setWelfareClaims((prev) =>
    prev.map((claim) => {
      if (claim.id !== id) return claim;

      const currentDisbursed = claim.amount_disbursed || 0;
      const newTotalDisbursed = currentDisbursed + paymentAmount;
      const approvedTarget = details.amount_approved || claim.amount_approved || claim.amount_requested;
      const isFullyPaid = newTotalDisbursed >= approvedTarget;

      const newDisbursementRecord = {
        id: `disb-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        claim_id: claim.id,
        amount: paymentAmount,
        date: now,
        payment_method: details.disbursement_method,
        payment_channel: details.disbursement_channel,
        voucher_no: details.disbursement_voucher_no,
        notes: details.pastoral_notes,
        disbursed_by: details.recorded_by,
        finance_account_id: details.finance_account_id,
        finance_account_name: details.finance_account_name,
        created_at: new Date().toISOString(),
      };

      const updatedDisbursements = [...(claim.disbursements || []), newDisbursementRecord];

      const updated: WelfareClaim = {
        ...claim,
        status: isFullyPaid ? 'disbursed' : 'approved',
        amount_approved: approvedTarget,
        amount_disbursed: newTotalDisbursed,
        disbursement_date: now,
        disbursement_method: details.disbursement_method,
        disbursement_channel: details.disbursement_channel,
        disbursement_voucher_no: details.disbursement_voucher_no,
        finance_account_id: details.finance_account_id || claim.finance_account_id,
        finance_account_name: details.finance_account_name || claim.finance_account_name,
        pastoral_notes: details.pastoral_notes || claim.pastoral_notes,
        disbursements: updatedDisbursements,
        updated_at: new Date().toISOString(),
      };

      if (dbSyncUpsert) {
        dbSyncUpsert('welfare_claims', updated);
      }

      logAction(
        'DISBURSE_WELFARE_CLAIM',
        'Welfare',
        `Disbursed GH₵ ${paymentAmount.toFixed(2)} to ${claim.member_name} (${isFullyPaid ? 'Fully Disbursed' : `Partial Payment, GH₵ ${(approvedTarget - newTotalDisbursed).toFixed(2)} remaining`}) - Voucher ${details.disbursement_voucher_no}`,
        id
      );

      return updated;
    })
  );
}

// ==========================================
// WELFARE EVENT MANAGEMENT
// ==========================================

export function createWelfareEvent(
  data: Omit<WelfareEvent, 'id' | 'created_at' | 'updated_at'>,
  setWelfareEvents: Dispatch<SetStateAction<WelfareEvent[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert?: (table: string, record: any) => Promise<void> | void
): WelfareEvent {
  const minContribution = Number(data.minimum_contribution) > 0 ? Number(data.minimum_contribution) : 20.0;
  const newEvent: WelfareEvent = {
    ...data,
    id: `wevt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    minimum_contribution: minContribution,
    status: data.status || 'open',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  setWelfareEvents((prev) => [newEvent, ...prev]);

  if (dbSyncUpsert) {
    dbSyncUpsert('welfare_events', newEvent);
  }

  logAction(
    'CREATE_WELFARE_EVENT',
    'Welfare',
    `Created welfare contribution event "${newEvent.title}" for ${newEvent.member_name} (Category: ${newEvent.category}, Min: GH₵ ${minContribution.toFixed(2)})`,
    newEvent.id
  );

  return newEvent;
}

export function updateWelfareEvent(
  id: string,
  updates: Partial<WelfareEvent>,
  setWelfareEvents: Dispatch<SetStateAction<WelfareEvent[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert?: (table: string, record: any) => Promise<void> | void
): WelfareEvent | undefined {
  let updatedEvent: WelfareEvent | undefined;

  setWelfareEvents((prev) =>
    prev.map((event) => {
      if (event.id !== id) return event;

      updatedEvent = {
        ...event,
        ...updates,
        updated_at: new Date().toISOString(),
      };

      if (dbSyncUpsert) {
        dbSyncUpsert('welfare_events', updatedEvent);
      }

      logAction(
        'UPDATE_WELFARE_EVENT',
        'Welfare',
        `Updated welfare event "${event.title}" (Status: ${updates.status || event.status})`,
        id
      );

      return updatedEvent;
    })
  );

  return updatedEvent;
}

export function closeWelfareEvent(
  id: string,
  closedBy: string,
  setWelfareEvents: Dispatch<SetStateAction<WelfareEvent[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert?: (table: string, record: any) => Promise<void> | void
) {
  return updateWelfareEvent(
    id,
    { status: 'closed' },
    setWelfareEvents,
    (action, mod, details, recId) =>
      logAction(action, mod, `${details} by ${closedBy}. Preserving all historical contribution records.`, recId),
    dbSyncUpsert
  );
}

export function deleteWelfareEvent(
  id: string,
  welfareEvents: WelfareEvent[],
  welfareEventContributions: WelfareEventContribution[],
  setWelfareEvents: Dispatch<SetStateAction<WelfareEvent[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncDelete?: (table: string, id: string) => Promise<void> | void
): { success: boolean; message: string } {
  const event = welfareEvents.find((e) => e.id === id);
  if (!event) return { success: false, message: 'Event not found' };

  const eventContributions = welfareEventContributions.filter((c) => c.event_id === id);
  const confirmedContributions = eventContributions.filter((c) => c.payment_status === 'confirmed');

  if (confirmedContributions.length > 0) {
    // If contributions have already been collected, do not delete; close or cancel instead
    return {
      success: false,
      message: `Cannot delete event with ${confirmedContributions.length} confirmed contribution(s). Change status to Closed or Cancelled instead to preserve financial records.`,
    };
  }

  setWelfareEvents((prev) => prev.filter((e) => e.id !== id));
  if (dbSyncDelete) {
    dbSyncDelete('welfare_events', id);
  }

  logAction('DELETE_WELFARE_EVENT', 'Welfare', `Deleted welfare event "${event.title}"`, id);
  return { success: true, message: `Event "${event.title}" deleted successfully.` };
}

// ==========================================
// WELFARE EVENT CONTRIBUTIONS
// ==========================================

export interface RecordEventContributionOptions {
  forceDuplicateConfirmation?: boolean;
  linkToChurchFinance?: boolean;
  financeAccountId?: string;
  financeAccountName?: string;
  setChurchFinances?: Dispatch<SetStateAction<ChurchFinanceRecord[]>>;
  setChurchAccounts?: Dispatch<SetStateAction<ChurchAccount[]>>;
}

export function recordEventContribution(
  data: Omit<WelfareEventContribution, 'id' | 'created_at' | 'updated_at'>,
  events: WelfareEvent[],
  existingContributions: WelfareEventContribution[],
  setWelfareEventContributions: Dispatch<SetStateAction<WelfareEventContribution[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert?: (table: string, record: any) => Promise<void> | void,
  options?: RecordEventContributionOptions
): { success: boolean; contribution?: WelfareEventContribution; error?: string; isDuplicateWarning?: boolean } {
  const event = events.find((e) => e.id === data.event_id);
  if (!event) {
    return { success: false, error: 'Welfare event not found.' };
  }

  // 1. Prevent contribution if event is closed or cancelled
  if (event.status === 'closed' || event.status === 'cancelled') {
    return {
      success: false,
      error: `Cannot record contributions for this event. Event status is currently "${event.status.toUpperCase()}".`,
    };
  }

  // 2. Enforce GH¢20.00 minimum contribution
  const minRequired = event.minimum_contribution > 0 ? event.minimum_contribution : 20.0;
  const numAmount = Math.round((Number(data.amount) || 0) * 100) / 100;

  if (numAmount < minRequired) {
    return {
      success: false,
      error: `Contribution amount of GH¢ ${numAmount.toFixed(2)} is below the minimum requirement of GH¢ ${minRequired.toFixed(2)}.`,
    };
  }

  // 3. Prevent accidental duplicate submissions without blocking legitimate additional contributions
  if (!options?.forceDuplicateConfirmation) {
    const today = new Date().toISOString().split('T')[0];
    const recentDuplicate = existingContributions.find(
      (c) =>
        c.event_id === data.event_id &&
        (c.member_id === data.member_id || c.contributor_name.trim().toLowerCase() === data.contributor_name.trim().toLowerCase()) &&
        Math.abs(c.amount - numAmount) < 0.01 &&
        c.payment_date === (data.payment_date || today) &&
        (data.reference_no && c.reference_no ? c.reference_no.trim().toLowerCase() === data.reference_no.trim().toLowerCase() : true)
    );

    if (recentDuplicate) {
      return {
        success: false,
        isDuplicateWarning: true,
        error: `A contribution of GH¢ ${numAmount.toFixed(2)} for ${data.contributor_name} on this event was already recorded today (Ref: ${recentDuplicate.reference_no || recentDuplicate.id}). Please confirm if this is an additional distinct contribution.`,
      };
    }
  }

  // 4. Create new contribution record
  let financeTransactionId: string | undefined = undefined;

  // Optional: Automatically create incoming Church Finance record for confirmed contributions
  if (
    data.payment_status === 'confirmed' &&
    options?.linkToChurchFinance &&
    options.setChurchFinances &&
    options.setChurchAccounts
  ) {
    financeTransactionId = `cfin-wevt-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const financeRecord: ChurchFinanceRecord = {
      id: financeTransactionId,
      transaction_type: 'income',
      account_id: options.financeAccountId || 'acc-ops',
      account_name: options.financeAccountName || 'Main Operating Account',
      category: 'Welfare Event Contributions',
      title: `Welfare Appeal: ${event.title} - ${data.contributor_name}`,
      recipient_or_vendor: data.contributor_name,
      amount: numAmount,
      currency: 'GHS',
      date: data.payment_date || new Date().toISOString().split('T')[0],
      payment_method: data.payment_method,
      reference_no: data.reference_no,
      department: 'Welfare & Benevolence',
      description: `Welfare event contribution for ${event.title} (Beneficiary: ${event.beneficiary_family_name || event.member_name})`,
      recorded_by: data.recorded_by,
      status: 'completed',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    options.setChurchFinances((prev) => [financeRecord, ...prev]);

    // Adjust holding account balance
    if (options.financeAccountId) {
      options.setChurchAccounts((prevAccs) =>
        prevAccs.map((acc) =>
          acc.id === options.financeAccountId
            ? { ...acc, current_balance: acc.current_balance + numAmount, updated_at: new Date().toISOString() }
            : acc
        )
      );
    }

    if (dbSyncUpsert) {
      dbSyncUpsert('church_finances', financeRecord);
    }
  }

  const newContribution: WelfareEventContribution = {
    ...data,
    amount: numAmount,
    finance_transaction_id: financeTransactionId || data.finance_transaction_id,
    id: `wec-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  setWelfareEventContributions((prev) => [newContribution, ...prev]);

  if (dbSyncUpsert) {
    dbSyncUpsert('welfare_event_contributions', newContribution);
  }

  logAction(
    'RECORD_EVENT_CONTRIBUTION',
    'Welfare',
    `Recorded GH¢ ${numAmount.toFixed(2)} (${data.payment_status}) from ${data.contributor_name} for event "${event.title}" [Method: ${data.payment_method}]`,
    newContribution.id
  );

  return { success: true, contribution: newContribution };
}

export function updateEventContribution(
  id: string,
  updates: Partial<WelfareEventContribution>,
  correctedBy: string,
  setWelfareEventContributions: Dispatch<SetStateAction<WelfareEventContribution[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert?: (table: string, record: any) => Promise<void> | void
) {
  setWelfareEventContributions((prev) =>
    prev.map((item) => {
      if (item.id !== id) return item;

      const updated: WelfareEventContribution = {
        ...item,
        ...updates,
        corrected_by: correctedBy,
        updated_at: new Date().toISOString(),
      };

      if (dbSyncUpsert) {
        dbSyncUpsert('welfare_event_contributions', updated);
      }

      logAction(
        'UPDATE_EVENT_CONTRIBUTION',
        'Welfare',
        `Corrected event contribution ${item.id} for ${item.contributor_name} by ${correctedBy} (Amount: GH¢ ${(updates.amount ?? item.amount).toFixed(2)}, Status: ${updates.payment_status || item.payment_status})`,
        id
      );

      return updated;
    })
  );
}

export function deleteEventContribution(
  id: string,
  welfareEventContributions: WelfareEventContribution[],
  deletedBy: string,
  setWelfareEventContributions: Dispatch<SetStateAction<WelfareEventContribution[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncDelete?: (table: string, id: string) => Promise<void> | void
) {
  const toDelete = welfareEventContributions.find((c) => c.id === id);
  setWelfareEventContributions((prev) => prev.filter((c) => c.id !== id));

  if (dbSyncDelete) {
    dbSyncDelete('welfare_event_contributions', id);
  }

  if (toDelete) {
    logAction(
      'DELETE_EVENT_CONTRIBUTION',
      'Welfare',
      `Deleted event contribution of GH¢ ${toDelete.amount.toFixed(2)} from ${toDelete.contributor_name} by ${deletedBy}`,
      id
    );
  }
}

