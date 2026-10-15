import { recordChurchFinance, updateChurchFinance, voidChurchFinance, type FinanceSnapshot } from '../finance/financeStore';
import { money } from '../../lib/ledgerUtils';
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
  dbSyncUpsert?: (table: string, record: any) => unknown
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
  dbSyncDelete?: (table: string, id: string) => unknown
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
  dbSyncUpsert?: (table: string, record: any) => unknown
): WelfareClaim {
  const claimSeq = crypto.randomUUID().slice(0, 8).toUpperCase();
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
  dbSyncUpsert?: (table: string, record: any) => unknown
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
  dbSyncDelete?: (table: string, id: string) => unknown
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

export function disburseWelfareClaim(id:string,details:{disbursement_method:PaymentMethod;disbursement_channel?:string;disbursement_voucher_no:string;amount_approved:number;amount_paid?:number;pastoral_notes?:string;finance_account_id?:string;finance_account_name?:string;finance_transaction_id?:string;recorded_by?:string},
  setClaims:Dispatch<SetStateAction<WelfareClaim[]>>,log:(action:string,module:string,details:string,id?:string)=>void,sync?: (table:string,record:any)=>unknown,claims:WelfareClaim[]=[]){
  const claim=claims.find(row=>row.id===id);if(!claim)throw new Error('Welfare claim not found.');
  if(!['approved','disbursed'].includes(claim.status))throw new Error('Approve the claim before disbursement.');
  const amount=money(details.amount_paid??details.amount_approved),approved=money(claim.amount_approved || details.amount_approved);
  const total=money((claim.amount_disbursed||0)+amount);
  if(amount<=0 || total>approved)throw new Error('Payment exceeds the remaining approved amount.');
  const now=new Date().toISOString(),date=now.slice(0,10);
  const payment={id:crypto.randomUUID(),claim_id:id,amount,date,payment_method:details.disbursement_method,payment_channel:details.disbursement_channel,
    voucher_no:details.disbursement_voucher_no,notes:details.pastoral_notes,disbursed_by:details.recorded_by,finance_account_id:details.finance_account_id,
    finance_account_name:details.finance_account_name,finance_transaction_id:details.finance_transaction_id,created_at:now};
  const updated:WelfareClaim={...claim,status:total>=approved?'disbursed':'approved',amount_approved:approved,amount_disbursed:total,
    disbursement_date:date,disbursement_method:details.disbursement_method,disbursement_channel:details.disbursement_channel,
    disbursement_voucher_no:details.disbursement_voucher_no,finance_account_id:details.finance_account_id,
    finance_account_name:details.finance_account_name,disbursements:[...(claim.disbursements||[]),payment],updated_at:now};
  setClaims(claims.map(row=>row.id===id?updated:row));sync?.('welfare_claims',updated);
  log('DISBURSE_WELFARE_CLAIM','Welfare',`Recorded GH₵ ${amount.toFixed(2)} against ${claim.claim_number}`,id);
}

// ==========================================
// WELFARE EVENT MANAGEMENT
// ==========================================

export function createWelfareEvent(
  data: Omit<WelfareEvent, 'id' | 'created_at' | 'updated_at'>,
  setWelfareEvents: Dispatch<SetStateAction<WelfareEvent[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert?: (table: string, record: any) => unknown
): WelfareEvent {
  const minContribution = Math.max(20, Number(data.minimum_contribution) || 20);
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
  dbSyncUpsert?: (table: string, record: any) => unknown
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
  dbSyncUpsert?: (table: string, record: any) => unknown
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
  dbSyncDelete?: (table: string, id: string) => unknown,
  force?: boolean,
  setWelfareEventContributions?: Dispatch<SetStateAction<WelfareEventContribution[]>>
): { success: boolean; message: string } {
  const event = welfareEvents.find((e) => e.id === id);
  if (!event) return { success: false, message: 'Event not found' };

  const eventContributions = welfareEventContributions.filter((c) => c.event_id === id);
  const confirmedContributions = eventContributions.filter((c) => c.payment_status === 'confirmed');

  if (eventContributions.length > 0) {
    // If contributions have already been collected, do not delete without explicit confirmation
    return {
      success: false,
      message: `Cannot delete event with ${confirmedContributions.length} confirmed contribution(s). Change status to Closed or Cancelled instead, or confirm force delete to remove all associated records.`,
    };
  }

  setWelfareEvents((prev) => prev.filter((e) => e.id !== id));
  if (setWelfareEventContributions) {
    setWelfareEventContributions((prev) => prev.filter((c) => c.event_id !== id));
  }
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
  state?: FinanceSnapshot;
  contributions?: WelfareEventContribution[];
  events?: WelfareEvent[];
}

export function recordEventContribution(
  data: Omit<WelfareEventContribution, 'id' | 'created_at' | 'updated_at'>,
  events: WelfareEvent[],
  existingContributions: WelfareEventContribution[],
  setWelfareEventContributions: Dispatch<SetStateAction<WelfareEventContribution[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert?: (table: string, record: any) => unknown,
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
  const minRequired = Math.max(20,event.minimum_contribution || 20);
  const numAmount = Math.round((Number(data.amount) || 0) * 100) / 100;

  if (!Number.isFinite(numAmount) || numAmount < minRequired) {
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

  if(data.payment_status==='confirmed' && options?.linkToChurchFinance){
    if(!options.state || !options.setChurchAccounts || !options.setChurchFinances || !options.financeAccountId) return {success:false,error:'Select a holding account for the welfare receipt.'};
    try {
      const receipt=recordChurchFinance({transaction_type:'income',account_id:options.financeAccountId,account_name:options.financeAccountName||'Welfare Account',
        category:'Welfare Event Contributions',title:`Welfare Appeal: ${event.title} - ${data.contributor_name}`,amount:numAmount,currency:'GHS',
        date:data.payment_date,payment_method:data.payment_method,reference_no:data.reference_no,department:'Welfare & Benevolence',status:'completed',recorded_by:data.recorded_by},
        options.setChurchFinances,options.setChurchAccounts,undefined,logAction,dbSyncUpsert,options.state);
      financeTransactionId=receipt.id;
    }catch(error){return {success:false,error:(error as Error).message};}
  }

  const newContribution: WelfareEventContribution = {
    ...data,
    amount: numAmount,
    finance_transaction_id: financeTransactionId || data.finance_transaction_id,
    finance_account_id: options?.financeAccountId || data.finance_account_id,
    finance_linked: options?.linkToChurchFinance || false,
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

export function updateEventContribution(id:string,updates:Partial<WelfareEventContribution>,actor:string,
  setContributions:Dispatch<SetStateAction<WelfareEventContribution[]>>,log:(action:string,module:string,details:string,id?:string)=>void,
  sync?:(table:string,record:any)=>unknown,options?:RecordEventContributionOptions){
  const before=options?.contributions?.find(row=>row.id===id);if(!before)throw new Error('Contribution not found. Refresh and try again.');
  if(before.payment_status==='voided')throw new Error('A voided contribution cannot be edited.');
  const event=options?.events?.find(row=>row.id===(updates.event_id||before.event_id));
  const next:WelfareEventContribution={...before,...updates,id:before.id,amount:money(updates.amount??before.amount),corrected_by:actor,updated_at:new Date().toISOString()};
  if(next.amount<Math.max(20,event?.minimum_contribution||20))throw new Error('Contribution is below the required minimum.');
  if(before.finance_transaction_id && updates.finance_linked===false)throw new Error('A posted receipt must be voided rather than unlinked.');
  const state=options?.state;
  const previousReceipt=state?.finances.find(row=>row.id===before.finance_transaction_id);
  if(before.finance_transaction_id && !previousReceipt)throw new Error('The linked treasury receipt is not loaded. Refresh before correcting this contribution.');
  if(previousReceipt && previousReceipt.status!=='voided'){
    if(!state || !options?.setChurchAccounts || !options.setChurchFinances)throw new Error('Treasury state is unavailable.');
    if(next.payment_status==='confirmed')updateChurchFinance(previousReceipt.id,{amount:next.amount,account_id:next.finance_account_id||previousReceipt.account_id,
      date:next.payment_date,payment_method:next.payment_method,reference_no:next.reference_no,title:`Welfare Appeal: ${event?.title||next.event_id} - ${next.contributor_name}`},
      options.setChurchFinances,options.setChurchAccounts,()=>{},log,sync||(()=>{}),state);
    else voidChurchFinance(previousReceipt.id,'Welfare receipt corrected or voided',actor,options.setChurchFinances,options.setChurchAccounts,()=>{},log,sync||(()=>{}),state);
  }else if(next.payment_status==='confirmed' && next.finance_linked){
    if(!state || !options?.setChurchAccounts || !options.setChurchFinances || !next.finance_account_id)throw new Error('Select a holding account for this confirmed contribution.');
    const account=state.accounts.find(row=>row.id===next.finance_account_id);
    const receipt=recordChurchFinance({transaction_type:'income',account_id:next.finance_account_id,account_name:account?.name||'Welfare Account',category:'Welfare Event Contributions',
      title:`Welfare Appeal: ${event?.title||next.event_id} - ${next.contributor_name}`,amount:next.amount,currency:'GHS',date:next.payment_date,payment_method:next.payment_method,status:'completed'},
      options.setChurchFinances,options.setChurchAccounts,undefined,log,sync,state);
    next.finance_transaction_id=receipt.id;
  }
  setContributions((options?.contributions||[]).map(row=>row.id===id?next:row));sync?.('welfare_event_contributions',next);
  log('UPDATE_EVENT_CONTRIBUTION','Welfare',`Corrected GH₵ ${next.amount.toFixed(2)} welfare receipt (${next.payment_status})`,id);
}

export function deleteEventContribution(id:string,contributions:WelfareEventContribution[],actor:string,
  setter:Dispatch<SetStateAction<WelfareEventContribution[]>>,log:(action:string,module:string,details:string,id?:string)=>void,
  _delete?:(table:string,id:string)=>unknown,options?:RecordEventContributionOptions,sync?:(table:string,record:any)=>unknown){
  updateEventContribution(id,{payment_status:'voided'},actor,setter,log,sync,{...options,contributions});
}
